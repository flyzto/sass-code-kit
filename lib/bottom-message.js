'use strict';

class BottomMessage {

    constructor() {
        this.item = null;
        this.bottomPanel = null;
        this.timer = null;
        this.mousemove = false;
    }

    addMessage(type, msgDom) {
        if(!this.bottomPanel) {
            this.item = document.createElement('div');
            this.item.classList.add('sck-bottom-message');
            this.bottomPanel = atom.workspace.addBottomPanel({ item: this.item });

            this.item.addEventListener('mouseover', () => {
                this.mousemove = true;
                if(this.timer) {
                    window.clearTimeout(this.timer);
                }
            });

            this.item.addEventListener('mouseout', () => {
                this.autoDestroy();
            });

        }
        let messageBox = document.createElement('div');
        messageBox.classList.add('message-box', type);
        messageBox.appendChild(msgDom);
        this.item.appendChild(messageBox);
        if(this.timer) {
            window.clearTimeout(this.timer);
        }
        if(!this.mousemove) {
            this.autoDestroy();
        }
    }

    autoDestroy() {
        let delay = 2500;
        this.timer = window.setTimeout(() => {
            this.destroy();
        }, delay);
    }

    destroy() {
        if(!this.bottomPanel) {
            return;
        }
        return this.bottomPanel.destroy();
    }

}

exports['default'] = BottomMessage;
module.exports = exports['default'];
