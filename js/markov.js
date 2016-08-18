/******************************************************************************
Copyright (c) 2016 Counterwave, Inc.

http://github.com/counterwave/jsmarkov


Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
******************************************************************************/

var _abbrevs = ["Mr.", "Mrs.", "Ms.", "Dr.", "St.", "A.M.", "P.M."];

function _splitText(text) {

    // collapse whitespace
    text = " "+text.trim().replace(/\s+/g,' ')+" ";

    // escape abbreviations so that we don't confuse them with punctuation
    for (var nt in _abbrevs) {
        var re = new RegExp(_abbrevs[nt].replace(/\./, "\\."), "g");
        text = text.replace(re, "__AB"+nt+"__");
    }

    // make a best effort to convert ' and " to smart quotes + apostrophe
    text = text.replace(/([ \(\[])\'/g,"$1\u2018"); // opening single quote
    text = text.replace(/\'([ \)\]])/g,"\u2019$1"); // closing single quote
    text = text.replace(/([ \(\]])\"/g,"$1\u201C"); // opening double quote
    text = text.replace(/\"([ \)\]])/g,"\u201D$1"); // closing single quote
    text = text.replace(/\'/g,"\u2019"); // must be an apostrophe

    // convert ... to elipsis
    text = text.replace(/\.\.\./g,"\u2026");
    // convert -- to em-dash
    text = text.replace(/--/g,"\u2014");

    // insert spaces around punctuation
    text = text.replace(/([a-zA-Z0-9_])([^a-zA-Z0-9_ ])/g,"$1 $2");
    text = text.replace(/([^a-zA-Z0-9_ ])([^a-zA-Z0-9_ ])/g,"$1 $2");
    text = text.replace(/([^a-zA-Z0-9_ ])([a-zA-Z0-9_])/g,"$1 $2");
    // except in cases of hyphenation and apostrophes (undo those)
    text = text.replace(/([a-zA-Z0-9_]) (-|\u2019) ([a-zA-Z0-9_])/g,"$1$2$3");

    // unescape abbreviations
    for (var nt in _abbrevs) {
        var re = new RegExp("__AB"+nt+"__", "g");
        text = text.replace(re, _abbrevs[nt]);
    }

    return text.trim().replace(/\s+/g,' ').split(' ');
}

function _needSpace(text, word) {
    // don't insert a space if text ends with an opening quote (single or double), open paren/brace/bracket, em-dash, or -
    if ("\u2018\u201C({[\u2014-".indexOf(text.charAt(text.length-1)) > -1) return false;
    // don't insert a space if word begins with a closing quote (single or double), close paren/brace/bracket, em-dash, or -,:;.!?
    if ("\u2019\u201D)}]\u2014-,:;.!?".indexOf(word.charAt(0)) > -1) return false;
    // otherwise, insert a space
    return true;
}

function _isBreak(prev, next) {
    return (prev.match(/^[.!?\u2019\u201D]$/) != null && next.match(/^[\u2018\u201CA-Z]/) != null);
}

function _isTerminal(word) {
    return (word.match(/^[.!?]$/) != null);
}


function markovModel(inputText) {

    var model = {
        followers: {},
        starts: {},
    };

    var words = _splitText(inputText);
    for (var i = 0; i < words.length - 2; i++) {
        // update followers
        var k = words[i]+" "+words[i+1];
        var f = words[i+2];
        if (!model.followers[k]) {
            model.followers[k] = {};
        }
        if (!model.followers[k][f]) {
            model.followers[k][f] = 1;
        } else {
            model.followers[k][f] += 1;
        }
        // update starts
        if (i == 0 && i+1 < words.length) {
            var s = words[i]+" "+words[i+1];
            model.starts[s] = 1;
        } else if (i+2 < words.length && _isBreak(words[i], words[i+1])) {
            var s = words[i+1]+" "+words[i+2];
            if (!model.starts[s]) {
                model.starts[s] = 1;
            } else {
                model.starts[s] += 1;
            }
        }
    }

    return model;
}

function markovText(model, targetLen) {
    var startsTotal = 0;
    for (var s in model.starts) {
        startsTotal += model.starts[s];
    }
    var startn = Math.random()*startsTotal;
    var start;
    for (var s in model.starts) {
        startn -= model.starts[s];
        if (startn <= 0) {
            start = s.split(' ');
            break;
        }
    }

    var one = start[0];
    var two = start[1];
    var three = "";
    var sp = _needSpace(one, two)?" ":"";
    var text = one+sp+two;
    do {
        var k = one+" "+two;
        var followersTotal = 0;
        if (model.followers[k]) {
            for (var f in model.followers[k]) {
                followersTotal += model.followers[k][f];
            }
        }
        if (followersTotal == 0) break;
        var n = Math.random()*followersTotal;
        for (var f in model.followers[k]) {
            n -= model.followers[k][f];
            if (n <= 0) {
                three = f;
                break;
            }
        }
        sp = _needSpace(text, three)?" ":"";
        text += sp+three;
        one = two;
        two = three;
    } while (!_isTerminal(three) || text.length < targetLen);

    return text;
}

function markovTaggedText(models, targetLen) {
    var startsTotal = 0;
    for (var m in models) {
        for (var s in models[m].starts) {
            startsTotal += models[m].starts[s];
        }
    }
    var startn = Math.random()*startsTotal;
    var start;
    var mi = -1;
    while (!start && ++mi < models.length) {
        for (var s in models[mi].starts) {
            startn -= models[mi].starts[s];
            if (startn <= 0) {
                start = s.split(' ');
                break;
            }
        }
    }

    var one = start[0];
    var two = start[1];
    var sp = _needSpace(one, two)?" ":"";
    var text = one+sp+two;
    var taggedText = "<span class='tag"+(mi+1)+"'>"+one+"</span>"+sp+"<span class='tag"+(mi+1)+"'>"+two+"</span>";
    var three = "";
    do {
        var k = one+" "+two;
        var followersTotal = 0;
        for (var m in models) {
            if (models[m].followers[k]) {
                for (var f in models[m].followers[k]) {
                    followersTotal += models[m].followers[k][f];
                }
            }
        }
        if (followersTotal == 0) break;
        var n = Math.random()*followersTotal;
        three = "";
        mi = -1;
        while (three.length == 0 && ++mi < models.length) {
            if (models[mi].followers[k]) {
                for (var f in models[mi].followers[k]) {
                    n -= models[mi].followers[k][f];
                    if (n <= 0) {
                        three = f;
                        break;
                    }
                }
            }
        }
        sp = _needSpace(text, three)?" ":"";
        text += sp+three;
        taggedText += sp+"<span class='tag"+(mi+1)+"'>"+three+"</span>";
        one = two;
        two = three;
    } while (!_isTerminal(three) || text.length < targetLen);

    return taggedText;
}
