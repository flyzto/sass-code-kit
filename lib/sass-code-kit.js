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
        let projectPaths = atom.project.getPaths();
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
            let config = JSON.parse(fs.readFileSync(configFile));
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
        this.compiler.setSassOptions(sassOptions);
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
            let messageContents = document.createElement('div');
            messageContents.innerHTML = `Compile ${message.name} success, output at `;
            let messagePath = document.createElement('a');
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

            let refreshCommand;
            let atomWorkspaceView = atom.views.getView(atom.workspace);
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
        let sassOptions = Object.assign({}, this.options.sass);
        let autoprefixerOptions = Object.assign({}, this.options.autoprefixer);
        let projectPath = this.getProjectPathOfFile(sassPath);
        let projectConfig;
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
            'sass-code-kit:insert-cache-buster': () => {
                this.insertCacheBuster(true);
            },
            'sass-code-kit:remove-cache-buster': () => {
                this.insertCacheBuster(false);
            }
        }));
    },

    manualCompile(event) {
        let filePath;
        let target = event.target;
        if(target.matches('.tree-view .file span')) {
            target = target.parentNode;
        }
        if(target.matches('.tree-view .file')) {
            let child = target.firstElementChild;
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
        let editor = atom.workspace.getActiveTextEditor();
        if(!editor || !this.isFileSass(editor.getPath())) {
            return;
        }
        let sortingConfigFile = SCKConfig.get('sorting.sortingRules');
        let sortingOptions = this.fetchConfig(sortingConfigFile);
        if(!sortingOptions) {
            atom.notifications.addWarning("PostCSS Sorting", {
                detail: "Postcss-sorting requires config file with sorting rules, Make sure 'Sorting rules config file path' in SassCodeKit settings is correct.",
                dismissable: true
            });
            return;
        }
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
        let itemSets = atom.contextMenu.itemSets;
        let contextMenuItem = null;
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
            let showItemOption = this.options.sass['showCompileSassItemInTreeViewContextMenu'];
            if(showItemOption) {
                let target = event.target;
                if(target.matches('.tree-view .file span')) {
                    target = target.parentNode;
                }
                if(target.matches('.tree-view .file')) {
                    let child = target.firstElementChild;
                    let filename = child.getAttribute('data-name');
                    return this.isFileSass(filename);
                }
            }
            return false;
        };
    },

    insertCacheBuster(insert) {
        if(this.isProcessing) {
            return;
        }
        let editor = atom.workspace.getActiveTextEditor();
        if(!editor || !this.isFileSass(editor.getPath())) {
            return;
        }
        let reg = new RegExp(/(url\([\'\"]?[^\'\"\)]+\.)(png|gif|jpg|jpeg|svg|webp|ttf|eot|woff)(\?v=[^\'\"\)]+)?([\'\"]?\))/ig);
        editor.setText(editor.getText().replace(reg, function(match, prefix, extname, stamp, suffix) {
            return `${prefix}${extname}${insert?'?v=#{$version}':''}${suffix}`;
        }));
    }

};

module.exports = exports['default']
