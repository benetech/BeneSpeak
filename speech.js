var BeneSpeak = {
    
    'BLOCK_DELIMITERS' : ['p', 'div', 'pagenum'],

    '_tokenize' : function(element) {
        var r = { 'src' : element, 'spanMap' : {}, 'text' : "", 'ttsMarkup' : "", 'markup' : element.innerHTML, 'lastOffset' : null};
        var t = {
            inTag : false,
            counter : 0,
            wsIdx : -1,
            weIdx : -1,
            text : '',
            markup : '',
            word : '',
            html : ''
        }
        
        var raw = element.innerHTML;
        var limit = raw.length;
        var i = 0;
        while (i <= limit) {
            if (t.inTag) {
                t.html += raw[i];
                if (raw[i] == ">") {
                    t.inTag = false;
                    
                    // if it's a block element delimiter,
                    // add a space to the plain text, and flush
                    // the accumulators
                    var tagCheck = t.html.match(/<\/(.*?)>$/);
                }
            } else {
                if (i == limit || raw[i].match(/\s/)) {
                    this._flush(t, r);
                    
                    // append the captured whitespace
                    if (i < limit) {
                        t.text += raw[i];
                        t.markup += raw[i];
                    }
                } else if (raw[i] == "<") {
                    t.inTag = true;
                    t.html += raw[i];
                } else {
                    if (t.word.length == 0) {
                        t.wsIdx = t.html.length;
                    }
                    t.weIdx = t.html.length + 1;
                    t.word += raw[i];
                    t.html += raw[i];
                }
            }
            i++;
        }
        
        r.text = t.text;
        r.ttsMarkup = t.markup;
        
        return r;
    },
    
    '_flush' : function(t, r) {
        if (t.word.length > 0) {
            var pos = t.text.length;
            r.spanMap[pos] = t.counter;
            t.text += t.word;
            t.markup += t.html.substring(0, t.wsIdx) +
                        '<span class="ttshlf" id="tts_' + t.counter + '">' +
                        t.html.substring(t.wsIdx, t.weIdx) +
                        '</span>' + t.html.substring(t.weIdx, t.html.length);
            t.word = "";
            t.html = "";
            t.wsIdx = -1;
            t.weIdx = -1;
            t.counter++;
        }
    },
    
    'speak' : function(element, callback) {
        var status = this._tokenize(element);
        chrome.tts.speak(status.text, { 'rate' : 1.25, 'desiredEventTypes' : ['word'], 'onEvent' : this._getEventListener(element, status, callback)});
    },
    
    'stop' : function(j) {
        chrome.tts.stop();
    },
    
    '_getEventListener' : function(element, status, callback) {
        return function(event) {
            if (event.type == 'word') {
                // look up the offset in the map
                if (status.spanMap.hasOwnProperty(event.charIndex)) {
                    if (status.lastOffset != null) {
                        var os = document.getElementById('tts_' + status.spanMap[status.lastOffset])
                        os.className = os.className.replace('ttshln', 'ttshlf');
                    }
                        
                    var ts = document.getElementById('tts_' + status.spanMap[event.charIndex]);
                    ts.className = ts.className.replace('ttshlf', 'ttshln');
                    status.lastOffset = event.charIndex;
                }
                var word = status.text.substring(event.charIndex, status.text.indexOf(" ", event.charIndex));
            } else if (event.type == 'start') {
                element.innerHTML = status.ttsMarkup;
            } else if (event.type == 'interrupted' || event.type == 'end') {
                element.innerHTML = status.markup;
                if (callback != null) {
                    callback();
                }
            }
        };
    },
}
