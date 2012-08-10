var BeneSpeak = {
    
    wordHighlightClass: 'ttsWordHL',
    sentenceHighlightClass: 'ttsSentHL',
    BOUNDARY_CHARS: /[\.,](?=\s|$)|[\!\?\s\"\;\u201c\u201d\u2013\u2014]/g,
    SENTENCE_TERMINATORS: /[\.\?\!]/,
    WORD_SEPARATORS: /[\s",;\u201c\u201d\u2013\u2014]/,
    CONDITIONAL_SEPARATORS: /'\u2018\u2019/,
    
    SpeechData: function() {
        this.document = null;
        this.utterance = '';
        this.words = [];
        this.sentences = [];
        this._highlightedWord = -1;
        this._highlightedSentence = -1;
        this._sipStart = null;
        this._sipOffset = -1;
        this._wipStart = null;
        this._wordRects = [];
        this._sentenceRects = [];
        
        this.xOffset = 0;
        this.yOffset = 0;
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
        if (d.document == null) {
            d.document = node.ownerDocument;
        }
        
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
                    var fnwc = /\S/.exec(t);
                    if (fnwc != null) {
                        d._wipStart = new BeneSpeak.Position(node, fnwc.index);
                    }
                }
                
                // only proceed if _wipStart could be initialized
                if (d._wipStart != null) {
                    // seek ahead to find boundary characters
                    var m = this.BOUNDARY_CHARS.exec(t);
                    while (m != null) {
                        // initialize _sipStart if needed
                        if (d._sipStart == null) {
                            d._sipStart = d._wipStart.copy();
                            d._sipOffset = d.utterance.length;
                        }
                        
                        BeneSpeak._processWordBoundary(d, node, m);
                        
                        // test against sentence boundaries
                        if (this.SENTENCE_TERMINATORS.test(m[0]) == true) {
                            d.utterance += ' ';
                            BeneSpeak._processSentenceBoundary(d, node, m);
                        }
                        
                        m = this.BOUNDARY_CHARS.exec(t);
                    }
                }
                
                break;
        }
        
        return d;
    },
    
    speak: function(element, callback) {
        var data = this.generateSpeechData(element);
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
        
        var r = d.document.createRange();
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
            d._wipStart = new BeneSpeak.Position(node, match.index + 1);
        } else {
            d._wipStart = null;
        }
        
    },
    
    _processSentenceBoundary: function(d, node, match) {
        
        var r = d.document.createRange();
        r.setStart(d._sipStart.node, d._sipStart.offset);
        r.setEnd(node, match.index + 1);
        
        // we need to find the word whose range start
        // matches that of this sentence.
        var offset = 0;
        for (var j = 0; j < d.words.length; j++) {
            var rangeStart = d.words[j].range.startOffset;
            if ((rangeStart.startContainer == d._sipStart.node) && (rangeStart.startOffset == d._sipStart.offset)) {
                offset = d.words[j].offset;
                break;
            }
        }
        
        var sent = new BeneSpeak.Fragment(r, d._sipOffset);
        if (sent.text.length > 0) {
            d.sentences.push(sent);
        }
        
        d._sipStart = null;
        d._sipOffset = 0;
        
    },
    
    _processBlockBoundary: function(d, blockNode) {
        
        if (d._wipStart != null) {
            var r = d.document.createRange();
            r.setStart(d._wipStart.node, d._wipStart.offset);
            r.setEndAfter(blockNode);
            
            var w = new BeneSpeak.Fragment(r, d.utterance.length);
            if (w.text.length > 0) {
                d.words.push(w);
            }
            
            d.utterance += w.text;
            d._wipStart = null;
        }
        
        if (d._sipStart != null) {
            var r = d.document.createRange();
            r.setStart(d._sipStart.node, d._sipStart.offset);
            r.setEndAfter(blockNode);
            
            var sent = new BeneSpeak.Fragment(r, d._sipOffset);
            if (sent.text.length > 0) {
                d.sentences.push(sent);
            }
            d._sipStart = null;
            d._sipOffset = 0;
        }
        
        d.utterance += '\n';
    },
    
    _elementStartAnnouncement: function(d, el) {
        var tag = el.tagName.toLowerCase(); 
        if (tag == 'table') {
            d.utterance += '\nBegin table. ';
        } else if (tag == 'tr') {
            d.utterance += '\nBegin table row. ';
        } else if (tag == 'td') {
            d.utterance += '\nTable cell. ';
        } else if (tag == 'ol') {
            d.utterance += '\nBegin ordered list. ';
        } else if (tag == 'ul') {
            d.utterance += '\nBegin list. ';
        } else if (tag == 'li') {
            d.utterance += '\nList item. ';
        }
    },
    
    _elementEndAnnouncement: function(d, el) {
        var tag = el.tagName.toLowerCase(); 
        if (tag == 'table') {
            d.utterance += '\nEnd table. ';
        } else if (tag == 'tr') {
            d.utterance += '\nEnd table row. ';
        } else if (tag == 'ol') {
            d.utterance += '\nEnd ordered list. ';
        } else if (tag == 'ul') {
            d.utterance += '\nEnd list. ';
        }
    },
    
};

BeneSpeak.SpeechData.prototype.clearWordHighlight = function() {
    while (this._wordRects.length > 0) {
        this.document.body.removeChild(this._wordRects.pop());
    }
    this._highlightedWord = -1;
};

BeneSpeak.SpeechData.prototype.clearSentenceHighlight = function() {
    while (this._sentenceRects.length > 0) {
        this.document.body.removeChild(this._sentenceRects.pop());
    }
    this._highlightedSentence = -1;
};

BeneSpeak.SpeechData.prototype.handleTtsEvent = function(event, callback) {
    
    if (event.type == 'word') {
        
        var wordIndex = this.wordAt(event.charIndex);
        if (wordIndex >= 0) {
            this.highlightWord(wordIndex);
        }
        
        var sentenceIndex = this.sentenceAt(event.charIndex);
        if (sentenceIndex >= 0) {
            this.highlightSentence(sentenceIndex);
        }
        
    } else if (event.type == 'interrupted' || event.type == 'end') {
        this.clearWordHighlight();
        this.clearSentenceHighlight();
        
        if (callback != null) {
            callback();
        }
    }    
};

BeneSpeak.SpeechData.prototype.highlightWord = function(idx) {
    if (this._highlightedWord != idx) {
        this.clearWordHighlight();
        this._highlightedWord = idx;
        var rects = this.words[idx].range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
            var div = this.document.createElement('div');
            this.document.body.appendChild(div);
            div.className = BeneSpeak.wordHighlightClass;
            div.style.position = 'absolute';
            div.style.top = (rects[i].top + window.scrollY + this.yOffset) + 'px';
            div.style.left = (rects[i].left + window.scrollX + this.xOffset) + 'px';
            div.style.width = rects[i].width + 'px';
            div.style.height = rects[i].height + 'px';
            this._wordRects.push(div);
        }
    }
};

BeneSpeak.SpeechData.prototype.highlightSentence = function(idx) {
    if (this._highlightedSentence != idx) {
        this.clearSentenceHighlight();
        this._highlightedSentence = idx;
        var rects = this.sentences[idx].range.getClientRects();
        for (var i = 0; i < rects.length; i++) {
            var div = this.document.createElement('div');
            this.document.body.appendChild(div);
            div.className = BeneSpeak.sentenceHighlightClass;
            div.style.position = 'absolute';
            div.style.top = (rects[i].top + window.scrollY + this.yOffset) + 'px';
            div.style.left = (rects[i].left + window.scrollX + this.xOffset) + 'px';
            div.style.width = rects[i].width + 'px';
            div.style.height = rects[i].height + 'px';
            this._sentenceRects.push(div);
        }
    }
};

BeneSpeak.SpeechData.prototype._getOffset = function(s) {
    if (s.slice(-2) == 'px') {
        return 0 - parseInt(s.substring(0, s.length - 2));
    } else {
        return 0;
    }
        
}

// locates the index of the word at the given character offset.
// When startFromBeginning is false (the default) it searches from
// the 0 index, otherwise it starts at the currently-highlighted word.
BeneSpeak.SpeechData.prototype.wordAt = function (charIndex, startFromBeginning) {
    var startIndex = (startFromBeginning) ? 0 : (this._highlightedWord == -1) ? 0 : this._highlightedWord;
    
    for (var i = startIndex; i < this.words.length; i++) {
        
        if (charIndex < this.words[i].offset) {
            return i - 1;
        } if (this.words[i].includes(charIndex)) {
            return i;
        }
    }
    return -1;
};

// locates the index of the sentence at the given character offset.
// When startFromBeginning is false (the default) it searches from
// the 0 index, otherwise it starts at the currently-highlighted sentence.
BeneSpeak.SpeechData.prototype.sentenceAt = function (charIndex, startFromBeginning) {
    var startIndex = (startFromBeginning) ? 0 : (this._highlightedSentence == -1) ? 0 : this._highlightedSentence;
    
    for (var i = startIndex; i < this.sentences.length; i++) {
        
        if (charIndex < this.sentences[i].offset) {
            return i - 1;
        } else if (this.sentences[i].includes(charIndex)) {
            return i;
        }
    }
    return -1;
};

BeneSpeak.Fragment.prototype.includes = function (index) {
    return ((index >= this.offset) && (index < (this.offset + this.text.length)));
};

BeneSpeak.Position.prototype.copy = function () {
    var r = new BeneSpeak.Position(this.node, this.offset);
    return r;
};

