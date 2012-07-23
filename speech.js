var BeneSpeak = {
    
    wordHighlightClass: 'ttsWordHL',
    sentenceHighlightClass: 'ttsSentHL',
    BOUNDARY_CHARS: /[\.\?\!\s",;\u201c\u201d\u2013\u2014]/g,
    SENTENCE_TERMINATORS: /[\.\?\!]/,
    WORD_SEPARATORS: /[\s",;\u201c\u201d\u2013\u2014]/,
    CONDITIONAL_SEPARATORS: /'\u2018\u2019/,
    
    SpeechData: function() {
        this.utterance = '';
        this.words = [];
        this.sentences = [];
        this.wordIndex = 0;
        this.sentenceIndex = 0;
        this._sipStart = null;
        this._wipStart = null;
        this._wordRects = [];
        this._sentenceRects = [];
    },
    
    Fragment: function(range, offset) {
        this.range = range;
        this.offset = offset;
        this.text = this.range.toString();
    },
    
    Position: function(node, offset) {
        this.node = node;
        this.offset = offset;
    },

    generateSpeechData: function(element) {
        r = new BeneSpeak.SpeechData();
        BeneSpeak._tokenize(element, r);
        return r;
    },
    
    _tokenize: function(node, data) {
        
        var d = data;
        
        switch(node.nodeType) {
            case 1:
                var cn = node.childNodes;
                
                // note that element-specific processing can happen here
                BeneSpeak._elementStartAnnouncement(d, node);
                
                for (var i = 0; i < cn.length; i++) {
                    this._tokenize(cn[i], d);
                }
                
                // break off the word if this is a block-level element
                if (this._isBlockElement(node)) {
                    BeneSpeak._processBlockBoundary(d, node);
                }
                
                BeneSpeak._elementEndAnnouncement(d, node);
                break;
            case 3:
                var t = node.textContent;
                
                // initialize _wipStart if needed
                if (d._wipStart == null) {
                    // seek to first non-whitespace character
                    var nwc = /\S/.exec(t);
                    if (nwc != null) {
                        d._wipStart = new BeneSpeak.Position(node, nwc.index);
                    }
                }
                
                // only proceed if _wipStart could be initialized
                if (d._wipStart != null) {
                    // seek ahead to find boundary characters
                    var m = this.BOUNDARY_CHARS.exec(t);
                    while (m != null) {
                        BeneSpeak._processWordBoundary(d, node, m);
                        m = this.BOUNDARY_CHARS.exec(t);
                    }
                }
                
                break;
        }
        
        return d;
    },
    
    speak: function(element, callback) {
        var data = this.generateSpeechData(element);
        console.log(data);
        chrome.tts.speak(data.utterance, { 'rate' : 1.25, 'desiredEventTypes' : ['word'], 'onEvent' : function(event) { data.handleTtsEvent(event, callback);}});
    },
    
    stop: function(j) {
        chrome.tts.stop();
    },
    
    _isBlockElement: function(el) {
        var style = window.getComputedStyle(el);
        return ((style.display.indexOf('inline') == -1) && (style.display.indexOf('ruby') == -1))
    },
    
    _processWordBoundary: function(d, node, match) {
        
        var r = document.createRange();
        r.setStart(d._wipStart.node, d._wipStart.offset);
        r.setEnd(node, match.index);
        
        var w = new BeneSpeak.Fragment(r, d.utterance.length);
        if (w.text.length > 0) {
            d.words.push(w);
        }
        
        d.utterance += w.text;
        d.utterance += match[0];
        
        // if advancing past the boundary character
        // moves us past the end of the textnode, null out
        // the word in progress var
        if (match.index + 1 < node.textContent.length) {
            d._wipStart.node = node;
            d._wipStart.offset = match.index + 1;
        } else {
            d._wipStart = null;
        }
        
    },
    
    _processBlockBoundary: function(d, blockNode) {
        
        if (d._wipStart != null) {
            var r = document.createRange();
            r.setStart(d._wipStart.node, d._wipStart.offset);
            //r.setEndBefore(blockNode.childNodes[blockNode.childNodes.length - 1]);
            r.setEndAfter(blockNode);
            
            var w = new BeneSpeak.Fragment(r, d.utterance.length);
            if (w.text.length > 0) {
                d.words.push(w);
            }
            
            d.utterance += w.text;
            d.utterance += '\n';
            d._wipStart = null;
        }
    },
    
    _elementStartAnnouncement: function(d, el) {
        if (el.tagName == 'TABLE') {
            d.utterance += '\nBegin table. ';
        } else if (el.tagName == 'TR') {
            d.utterance += '\nBegin table row. ';
        } else if (el.tagName == 'TD') {
            d.utterance += '\nTable cell. ';
        } else if (el.tagName == 'OL') {
            d.utterance += '\nBegin ordered list. ';
        } else if (el.tagName == 'UL') {
            d.utterance += '\nBegin list. ';
        } else if (el.tagName == 'LI') {
            d.utterance += '\nList item. ';
        }
    },
    
    _elementEndAnnouncement: function(d, el) {
        if (el.tagName == 'TABLE') {
            d.utterance += '\nEnd table. ';
        } else if (el.tagName == 'TR') {
            d.utterance += '\nEnd table row. ';
        } else if (el.tagName == 'OL') {
            d.utterance += '\nEnd ordered list. ';
        } else if (el.tagName == 'UL') {
            d.utterance += '\nEnd list. ';
        }
    },
    
    _buildSentenceRects: function(rects) {
    }
};

BeneSpeak.SpeechData.prototype.clearWordRects = function() {
    while (this._wordRects.length > 0) {
        document.body.removeChild(this._wordRects.pop());
    }
};

BeneSpeak.SpeechData.prototype.handleTtsEvent = function(event, callback) {
    console.log(this);
    if (event.type == 'word') {
        
        while (this.wordIndex < this.words.length) {
            
            if (event.charIndex < this.words[this.wordIndex].offset) {
                // char index is /before/ the selected word. hang here for now
                break;
            }
            
            if (this.words[this.wordIndex].includes(event.charIndex)) {
                this.buildWordRects();
                break;
            }
            this.wordIndex++;
        }
        
    } else if (event.type == 'interrupted' || event.type == 'end') {
        // clear highlighting
        this.wordIndex = 0;
        this.clearWordRects();
        
        if (callback != null) {
            callback();
        }
    }    
};

BeneSpeak.SpeechData.prototype.buildWordRects = function() {
    this.clearWordRects();
    var rects = this.words[this.wordIndex].range.getClientRects();
    for (var i = 0; i < rects.length; i++) {
        var div = document.createElement('div');
        document.body.appendChild(div);
        div.className = BeneSpeak.wordHighlightClass;
        div.style.position = 'absolute';
        div.style.top = rects[i].top + window.scrollY;
        div.style.left = rects[i].left + window.scrollX;
        div.style.width = rects[i].width;
        div.style.height = rects[i].height;
        this._wordRects.push(div);
    }
};

BeneSpeak.Fragment.prototype.includes = function (index) {
    console.log("Testing " + index + " against range " + this.offset + ":" + (this.offset + this.text.length));
    return ((index >= this.offset) && (index < (this.offset + this.text.length)));
};

