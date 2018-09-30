'use strict';

module.exports =  {
    options: {
        sass: {
            title: 'Sass Options',
            type: 'object',
            order: 10,
            properties: {
                compileOnSave: {
                    title: 'Compile on Save',
                    description: 'This option en-/disables auto compiling on save',
                    type: 'boolean',
                    default: true,
                    order: 10
                },
                showCompileSassItemInTreeViewContextMenu: {
                    title: 'Show \'Compile Sass\' item in Tree View context menu',
                    description: 'If enabled, Tree View context menu contains a \'Compile Sass\' item that allows you to compile that file via context menu',
                    type: 'boolean',
                    default: true,
                    order: 11
                },
                outputStyle: {
                    title: 'Output Style',
                    description: 'Output style for CSS',
                    type: 'string',
                    enum: ['Compressed', 'Compact', 'Nested', 'Expanded'],
                    default: 'Expanded',
                    order: 12
                },
                precision: {
                    title: 'Precision',
                    description: 'Used to determine how many digits after the decimal will be allowed. For instance, if you had a decimal number of 1.23456789 and a precision of 5, the result will be 1.23457 in the final CSS',
                    type: 'integer',
                    default: 5,
                    minimum: 0,
                    order: 13
                },
                includePaths: {
                    title: 'Include paths',
                    description: 'Paths to look for imported files (@import declarations); comma separated, each path surrounded by quotes',
                    type: 'array',
                    default: [],
                    items: {
                        type: 'string'
                    },
                    order: 14
                }
            }
        },
        autoprefixer: {
            title: 'Autoprefixer Options',
            type: 'object',
            order: 11,
            properties: {
                enabled: {
                    title: 'Autoprefixer',
                    description: 'Prefix the compiled CSS with [Autoprefixer](https://github.com/postcss/autoprefixer)',
                    type: 'boolean',
                    default: false,
                    order: 10
                },
                cascade: {
                    title: 'Cascade prefixes',
                    type: 'boolean',
                    default: false,
                    order: 11
                },
                remove: {
                    title: 'Remove unneeded prefixes',
                    type: 'boolean',
                    default: true,
                    order: 12
                },
                browsers: {
                    title: 'Supported browsers',
                    description: 'Using the [following syntax](https://github.com/ai/browserslist#queries)',
                    type: 'array',
                    default: ['> 1%', 'last 2 versions', 'Firefox ESR', 'not dead'],
                    items: {
                        type: 'string'
                    },
                    order: 13
                }
            }
        },
        sorting: {
            title: 'PostCSS Sorting Options',
            type: 'object',
            order: 12,
            properties: {
                sortingRules: {
                    title: 'Sorting rules config file path',
                    type: 'string',
                    default: ''
                }
            }
        }
    },
    get(key) {
        return atom.config.get(`sass-code-kit.${key}`);
    },
    set(key, value) {
        return atom.config.set(`sass-code-kit.${key}`, value);
    }
}
