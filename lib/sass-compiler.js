'use strict';

const { BufferedProcess, Emitter } = require('atom');
const fs = require('fs');
const path = require('path');

const sass = require('sass');
const postcss = require('postcss');
const autoprefixer = require('autoprefixer');

class SassCompiler {

    constructor(options) {
        this.emitter = new Emitter();
        this.options = options;
        this.projectPath = "";
        this.dependentList = null;
        this.sassOptions = null;
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
        let sassFiles = this.sassFilesforSassFile(this.inputFile);
        this.compilerCounter = sassFiles.length;
        if(!this.compilerCounter) {
            return;
        }
        this.emitter.emit('start');
        sassFiles.forEach(item => {
            this.generateCssForSassFile(item);
        });
    }

    setSassOptions(options) {
        if(!options) {
            return;
        }
        this.sassOptions = {
            outputStyle: options.outputStyle.toLowerCase(),
            precision: options.precision,
            includePaths: options.includePaths
        }
        if(options.projectPath) {
            this.projectPath = options.projectPath;
        }
        if(options.dependentList) {
            this.dependentList = options.dependentList;
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
        this.isAutoprefixer = this.isExecuteFile(options);
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
        let files = fs.readdirSync(directory);
        let sassFiles = files.filter(item => {
            return this.isFileSass(item) && !this.isFilePartial(item);
        });
        return sassFiles.map(item => {
            return path.join(directory, item);
        });
    }

    sassFilesforSassFile(file) {
        if(this.dependentList) {
            let fileItem = path.relative(this.projectPath, file);
            let fileList = this.dependentList[fileItem]
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
        let directoryList = ['css', 'style', 'styles', 'stylesheets'];
        let cssDirectory;
        directoryList.forEach(item => {
            let dir = path.join(path.dirname(directory), item);
            if(fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                cssDirectory = dir;
            }
        });
        if(cssDirectory) {
            return cssDirectory;
        }
        return directory;
    }

    cssFileForSassFile(file) {
        let directory = path.dirname(file);
        let fileName = path.basename(file).replace(/\.s[ac]ss/ig, "");
        let cssName = `${fileName}.css`;
        let cssFile = path.join(directory, cssName);
        if(!fs.existsSync(cssFile) || !fs.statSync(cssFile).isFile()) {
            let cssDirectory = this.cssDirectoryForSassDirectory(directory);
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
        let fileName = path.basename(cssFile, '.css');
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
        let cssFile = this.cssFileForSassFile(file);
        let fileName = path.basename(cssFile, '.css');
        let renderOptions = Object.assign({ file }, this.sassOptions);
        sass.render(renderOptions, (error, result) => {
            if(error) {
                this.emitter.emit('error', {
                    name: fileName,
                    error: error
                });
                return this.releaseCounter();
            }
            else {
                let cssString = result.css.toString();
                if(this.isAutoprefixer) {
                    let prefixer = postcss([autoprefixer(this.prefixerOptions)]);
                    prefixer.process(cssString).then(fixerResult => {
                       this.generateCssFilefromData(cssFile, fixerResult.css);
                    });
                }
                else {
                    this.generateCssFilefromData(cssFile, cssString);
                }
            }
        });
    }

    isExecuteFile(options) {
        if(!this.projectPath) {
            return true;
        }
        let isIgore = false, isExecute = false;
        let matchFun = item => {
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
