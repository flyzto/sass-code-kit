'use strict';

const { Emitter } = require('atom');

const postcss = require('postcss');
const postcssScss = require('postcss-scss');
const postcssSorting = require('postcss-sorting');

class Sorting {
    constructor() {
        this.emitter = new Emitter();
        this.contents = null;
        this.options = null;
    }
    destroy() {
        this.emitter.dispose();
        this.emitter = null;
    }
    setContents(contents) {
        this.contents = contents;
    }
    setOptins(options) {
        this.options = options;
    }
    sortingContents() {
        var sorting = postcss([postcssSorting(this.options)]);
        sorting.process(this.contents, {syntax: postcssScss}).then(result => {
            this.emitter.emit('success', result);
        });
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
}

exports['default'] = Sorting;
module.exports = exports['default'];
