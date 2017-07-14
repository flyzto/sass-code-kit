'use strict';

const { CompositeDisposable } = require('atom');
const shell = require('shell');

const SCKConfig = require('./config');
const SassCompiler = require('./sass-compiler');
const PostcssSorting = require('./postcss-sorting.js');
const BottomMessage = require('./bottom-message.js');

const fs = require('fs');
const path = require('path');

exports['default'] = {

    subscriptions: null,
    editorSubscriptions: null,

    config: SCKConfig.options,

    options: {
        sass: null,
        autoprefixer: null
    },

    activate() {

        this.subscriptions = new CompositeDisposable();
        this.editorSubscriptions = new CompositeDisposable();

        this.isProcessing = false;

        this.registerConfigObserveCallback();
        this.registerCommands();
        this.registerTextEditorSaveCallback();
        this.registerContextMenuItem();

    },

    deactivate() {
        this.subscriptions.dispose();
        this.editorSubscriptions.dispose();
    },

    registerConfigObserveCallback() {
        this.subscriptions.add(atom.config.observe('sass-code-kit', value => {
            this.options.sass = SCKConfig.get('sass');
            this.options.autoprefixer = SCKConfig.get('autoprefixer');
        }));
    },

    registerTextEditorSaveCallback() {
        this.editorSubscriptions.add(atom.workspace.observeTextEditors(editor => {
            this.subscriptions.add(editor.onDidSave(event => {
                if(!this.isFileSass(event.path)) {
                    return;
                }
                this.compileFromPath(event.path);
            }));
        }));
    },

    isFileSass(file) {
        return ['.scss', '.sass'].indexOf(path.extname(file)) > -1;
    },

    getProjectPathOfFile(file) {
        var projectPaths = atom.project.getPaths();
        return projectPaths.filter(function(item) {
            return file.startsWith(item);
        }).sort().pop();
    },
    fetchConfig(configFile) {
        if(!fs.existsSync(configFile)) {
            return;
        }
        if(!fs.statSync(configFile).isFile()) {
            return;
        }
        try {
            var config = JSON.parse(fs.readFileSync(configFile));
            if(!config) {
                return;
            }
            return config;
        }
        catch(err) {
            atom.notifications.addError('Parse config error', {
                detail: err.description,
                dismissable: true
            });
        }
        return;
    },
    compile(sassOptions, autoprefixerOptions, file) {
        if(this.isProcessing) {
            return;
        }
        this.compiler = new SassCompiler();
        this.compiler.setupInputFile(file);
        this.compiler.setSassParameters(sassOptions);
        this.compiler.addSassParameter('default-encoding', 'utf-8');
        this.compiler.setPrefixerOptions(autoprefixerOptions);

        this.compiler.onStart(() => {
            // console.log('Compile start');
            this.isProcessing = true;
        });
        this.compiler.onError(message => {
            atom.notifications.addError(`Compile ${message.name} error`, {
                detail: message.error,
                dismissable: true
            });
        });
        this.compiler.onSuccess(message => {
            if(!this.successHint) {
                this.successHint = new BottomMessage();
            }
            var messageContents = document.createElement('div');
            messageContents.innerHTML = `Compile ${message.name} success, output at `;
            var messagePath = document.createElement('a');
            messagePath.innerHTML = message.path;
            messagePath.setAttribute('href', 'javascript');
            messagePath.addEventListener('click', () => {
                shell.showItemInFolder(message.path);
            });
            messageContents.appendChild(messagePath);
            this.successHint.addMessage('success', messageContents);
        });
        this.compiler.onFinished(() => {
            this.isProcessing = false;
            this.compiler.destroy();
            this.compiler = null;

            this.successHint = null;

            var refreshCommand;
            var atomWorkspaceView = atom.views.getView(atom.workspace);
            atom.commands.findCommands({target: atomWorkspaceView}).some(item => {
                if(item.name === 'preview-in-chrome:refresh') {
                    refreshCommand = item;
                    return true;
                }
                return false;
            });

            if(refreshCommand) {
                atom.commands.dispatch(atomWorkspaceView, 'preview-in-chrome:refresh');
            }
            // console.log('Compile finished');
        });
        this.compiler.doCompile();

    },
    compileFromPath(sassPath, manual) {
        var sassOptions = Object.assign({}, this.options.sass);
        var autoprefixerOptions = Object.assign({}, this.options.autoprefixer);
        var projectPath = this.getProjectPathOfFile(sassPath);
        var projectConfig;
        if(projectPath) {
            projectConfig = this.fetchConfig(path.join(projectPath, 'package.json'));
            sassOptions.projectPath = projectPath;
        }
        if(projectConfig) {
            Object.assign(sassOptions, projectConfig.sass);
            Object.assign(autoprefixerOptions, projectConfig.autoprefixer);
        }
        if(sassOptions.compileOnSave || manual) {
            this.compile(sassOptions, autoprefixerOptions, sassPath);
        }
    },
    registerCommands() {
        this.subscriptions.add(atom.commands.add('atom-workspace', {
            'sass-code-kit:sass-compile': event => {
                this.manualCompile(event);
            },
            'sass-code-kit:sass-sorting': () => {
                this.sassSorting();
            },
            'sass-code-kit:insert-timestamp': () => {
                this.insertTimeStamp(true);
            },
            'sass-code-kit:remove-timestamp': () => {
                this.insertTimeStamp(false);
            }
        }));
    },
    manualCompile(event) {
        var filePath;
        var target = event.target;
        if(target.matches('.tree-view .file span')) {
            target = target.parentNode;
        }
        if(target.matches('.tree-view .file')) {
            var child = target.firstElementChild;
            filePath = child.getAttribute('data-path');
        }
        else if(atom.workspace.getActiveTextEditor() && atom.workspace.getActiveTextEditor().getPath()) {
            filePath = atom.workspace.getActiveTextEditor().getPath();
        }
        if(filePath) {
            this.compileFromPath(filePath, true);
        }
    },
    sassSorting() {
        if(this.isProcessing) {
            return;
        }
        var editor = atom.workspace.getActiveTextEditor();
        if(!editor || !this.isFileSass(editor.getPath())) {
            return;
        }
        var sortingConfigFile = SCKConfig.get('sorting.sortingRules');
        var sortingOptions = this.fetchConfig(sortingConfigFile);
        this.sorter = new PostcssSorting();
        this.sorter.setContents(editor.getText());
        this.sorter.setOptins(sortingOptions);
        this.sorter.sortingContents();
        this.sorter.onSuccess(result => {
            editor.setText(result.css);
            this.sorter.destroy();
            this.sorter = null;
        });
    },
    registerContextMenuItem() {
        var itemSets = atom.contextMenu.itemSets;
        var contextMenuItem = null;
        itemSets.some(function(itemSet) {
            if(itemSet.selector === '.tree-view .file') {
                return itemSet.items.some(function(item) {
                    if(item.id === 'sass-code-kit-context-menu-compile') {
                        contextMenuItem = item;
                        return true;
                    }
                    return false;
                });
            }
            return false;
        });
        contextMenuItem.shouldDisplay = event => {
            var showItemOption = this.options.sass['showCompileSassItemInTreeViewContextMenu'];
            if(showItemOption) {
                var target = event.target;
                if(target.matches('.tree-view .file span')) {
                    target = target.parentNode;
                }
                if(target.matches('.tree-view .file')) {
                    var child = target.firstElementChild;
                    var filename = child.getAttribute('data-name');
                    return this.isFileSass(filename);
                }
            }
            return false;
        };
    },
    insertTimeStamp(insert) {
        if(this.isProcessing) {
            return;
        }
        var editor = atom.workspace.getActiveTextEditor();
        if(!editor || !this.isFileSass(editor.getPath())) {
            return;
        }
        var reg = new RegExp(/(url\([\'\"]?[^\'\"\)]+\.)(png|gif|jpg|jpeg|svg|ttf|eot|woff)(\?v=[^\'\"\)]+)?([\'\"]?\))/ig);
        editor.setText(editor.getText().replace(reg, function(match, prefix, extname, stamp, suffix) {
            return `${prefix}${extname}${insert?'?v=#{$version}':''}${suffix}`;
        }));
    }
};

module.exports = exports['default']
