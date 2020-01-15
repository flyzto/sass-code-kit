# sass-code-kit package

1. Compile SCSS to CSS whith [node-sass](https://github.com/sass/node-sass)
2. Prefix the CSS with [Autoprefixer](https://github.com/postcss/autoprefixer)

**NOTICE: In version 1.0.0, Sass attribute 'includePath' has been changed to 'includePaths', If you have used the old version before, please refill the configuration item**

Project config file example (package.json)

```json
{
    "name": "project name",
    "version": "0.1",
    "sass": {
        "compileOnSave": true,
        "outputStyle": "expanded",
        "precision": 5,
        "dependentList": {
            "folder_template/_template.scss": [
                "static/themes/blue/sass/style.scss",
                "static/themes/green/sass/style.scss",
                "static/themes/orange/sass/style.scss",
                "static/themes/pink/sass/style.scss"
            ]
        }
    },
    "autoprefixer": {
        "enabled": true,
        "overrideBrowserslist": "> 5%",
        "execute": [
            "folder1/sass",
            "folder2/sass/a.scss"
        ],
        "ignore": [
            "folder1/sass/a.scss",
            "folder1/sass/b.scss"
        ]
    }
}
```
