# sass-code-kit package

Compile SASS file to CSS file and Prefix the CSS with [Autoprefixer](https://github.com/postcss/autoprefixer)

Based on [Sass Ruby gem](http://sass-lang.com/install)

Project config file example (package.json)

```json
{
    "name": "project name",
    "version": "0.1",
    "sass": {
        "compileOnSave": true,
        "compileStyle": "expanded",
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
        "browsers": "> 5%",
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
