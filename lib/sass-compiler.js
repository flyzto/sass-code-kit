'use strict';

const { BufferedProcess, Emitter } = require('atom');
const fs = require('fs');
const path = require('path');

const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

class SassCompiler {
    constructor() {
        this.emitter = new Emitter();
        this.sassParameters = [];
        this.projectPath = "";
        this.dependentList = null;
        this.prefixerOptions = null;
        this.isAutoprefixer = false;
        this.inputFile = null;
        this.compilerCounter = 0;
    }
    destroy() {
        this.emitter.dispose();
        this.emitter = null;
    }
    doCompile() {
        if(!this.isFileSass(this.inputFile)) {
            return;
        }
        var sassFiles = this.sassFilesforSassFile(this.inputFile);
        this.compilerCounter = sassFiles.length;
        if(!this.compilerCounter) {
            return;
        }
        this.emitter.emit('start');
        sassFiles.forEach(item => {
            this.generateCssForSassFile(item);
        });
    }
    setSassParameters(options) {
        if(!options) {
            return;
        }
        if(options.compileStyle) {
            this.addSassParameter('style', options.compileStyle.toLowerCase())
        }
        if(options.precision) {
            this.addSassParameter('precision', options.precision);
        }
        if(options.includePath && options.includePath.length) {
            options.includePath.forEach(path => {
                this.addSassParameter('load-path', path);
            });
        }
        if(options.projectPath) {
            this.projectPath = options.projectPath;
        }
        if(options.dependentList) {
            this.dependentList = options.dependentList;
        }
    }
    addSassParameter(key, value) {
        this.sassParameters.push(`--${key}`);
        if(value) {
            this.sassParameters.push(value);
        }
    }
    setPrefixerOptions(options) {
        if(!options.enabled) {
            return;
        }
        this.prefixerOptions = {
            cascade: options.cascade,
            remove: options.remove,
            browsers: options.browsers
        };
        this.isAutoprefixer = this.isIncludeFile(options);
    }
    setupInputFile(inputfile) {
        if(!inputfile) {
            return;
        }
        this.inputFile = inputfile;
    }
    isFileSass(file) {
        return ['.scss', '.sass'].indexOf(path.extname(file)) > -1;
    }
    isFilePartial(file) {
        return path.basename(file)[0] === '_';
    }
    sassFilesForSassDirectory(directory) {
        var files = fs.readdirSync(directory);
        var sassFiles = files.filter(item => {
            return this.isFileSass(item) && !this.isFilePartial(item);
        });
        return sassFiles.map(item => {
            return path.join(directory, item);
        });
    }
    sassFilesforSassFile(file) {

        if(this.dependentList) {
            var fileItem = path.relative(this.projectPath, file);
            var fileList = this.dependentList[fileItem]
            if(fileList && fileList.length) {
                return fileList.map(item => {
                    return path.join(this.projectPath, item);
                });
            }
        }

        if(!this.isFilePartial(file)) {
            return [file];
        }
        return this.sassFilesForSassDirectory(path.dirname(file));
    }
    cssDirectoryForSassDirectory(directory) {
        var cssDirectory = path.join(path.dirname(directory), 'css');
        if(fs.existsSync(cssDirectory) && fs.statSync(cssDirectory).isDirectory()) {
            return cssDirectory;
        }
        return directory;
    }
    cssFileForSassFile(file) {
        var directory = path.dirname(file);
        var fileName = path.basename(file).replace(/\.s[ac]ss/ig, "");
        var cssName = `${fileName}.css`;
        var cssFile = path.join(directory, cssName);
        if(!fs.existsSync(cssFile) || !fs.statSync(cssFile).isFile()) {
            var cssDirectory = this.cssDirectoryForSassDirectory(directory);
            cssFile = path.join(cssDirectory, cssName);
        }
        return cssFile;
    }
    releaseCounter() {
        this.compilerCounter -= 1;
        if(this.compilerCounter === 0) {
            this.emitter.emit('finished');
        }
    }
    generateCssFilefromData(cssFile, data, callback) {
        var fileName = path.basename(cssFile, '.css');
        fs.writeFile(cssFile, data, errMessage => {
            if(errMessage) {
                this.emitter.emit('error', {
                    name: fileName,
                    error: errMessage
                });
                this.releaseCounter();
                return;
            }
            this.emitter.emit('success', {
                name: fileName,
                path: cssFile
            });
            this.releaseCounter();
            callback && callback();
        });
    }
    generateCssForSassFile(file) {
        if(!file) {
            return;
        }
        var cssFile = this.cssFileForSassFile(file);
        var fileName = path.basename(cssFile, '.css');
        var commandPara = [];
        if(this.sassParameters && this.sassParameters.length) {
            commandPara = this.sassParameters.concat();
        }
        commandPara.push(file);
        var cssString = '';
        return new BufferedProcess({
            command: 'sass',
            args: commandPara,
            stdout: (output) => {
				cssString += output;
			},
            stderr: (error) => {
                this.emitter.emit('error', {
                    name: fileName,
                    error: error
                });
                return this.releaseCounter();
			},
            exit: (code) => {
                if(code === 0) {
                    if(this.isAutoprefixer) {
                        var prefixer = postcss([autoprefixer(this.prefixerOptions)]);
                        prefixer.process(cssString).then(result => {
                            this.generateCssFilefromData(cssFile, result.css, () => {
                                cssString = '';
                            });
                        });
                    }
                    else {
                        this.generateCssFilefromData(cssFile, cssString, () => {
                            cssString = '';
                        });
                    }
                }
                else {
                    return this.releaseCounter();
                }
            }
        });
    }
    isIncludeFile(options) {
        if(!this.projectPath) {
            return true;
        }
        var isIgore = false, isExecute = false;
        var matchFun = item => {
            return this.inputFile.startsWith(path.join(this.projectPath, item));
        }
        if(options.execute && options.execute.length) {
            isExecute = options.execute.some(matchFun);
        }
        else {
            isExecute = true;
        }
        if(options.ignore && options.ignore.length) {
            isIgore = options.ignore.some(matchFun);
        }
        else {
            isIgore = false;
        }
        if(isIgore) {
            return false;
        }
        if(isExecute) {
            return true;
        }
        return false;;
    }
    onStart(callback) {
        return this.emitter.on('start', callback);
    }
    onSuccess(callback) {
        return this.emitter.on('success', callback);
    }
    onError(callback) {
        return this.emitter.on('error', callback);
    }
    onFinished(callback) {
        return this.emitter.on('finished', callback);
    }
}

exports['default'] = SassCompiler;
module.exports = exports['default']
