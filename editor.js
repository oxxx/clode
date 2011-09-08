var extractText = function(node, line, column, infos) {
    var text = '';
    var info = { node: node, before: { line: line, column: column }};
    if (node.nodeName == 'BR') {
        text = '\n';
        line++;
        column = 0;
    }
    else if (node.nodeName == '#text') {
        for (var c = 0; c < node.data.length; ++c) {
            if (node.data[c] == '\n') {
                line++;
                column = 0;
            }
            else {
                column++;
            }
        }
        text += node.data;
    }

    for(var i = 0; i < node.childNodes.length; ++i) {
        var child = node.childNodes[i];
        var result = extractText(node.childNodes[i], line, column, infos);
        text += result.text;
        line = result.line;
        column = result.column;
    }
    info.after = { line: line, column: column };
    infos.push(info);

    return { text: text, line: line, column: column };
}

var extractCursorPosition = function(nodeInfo, offset) {
    var pos = { line: nodeInfo.before.line, column: nodeInfo.before.column };
    if (nodeInfo.node.nodeName == '#text') {
        for (var c = 0; c < nodeInfo.node.data.length; ++c) {
            if (offset == c) {
                break;
            }
            if (nodeInfo.node.data[c] == '\n') {
                pos.line++;
                pos.column = 0;
            }
            else {
                pos.column++;
            }
        }
    }
    //console.log('Extracted position: ' + pos.line + ':' + pos.column);
    return pos;
}

var extractTextAndCursorPosition = function () {
    var sel = rangy.getSelection();
    var range = sel.getRangeAt(0);
    //console.log('Range: ' + range.startContainer.nodeName + ':' + range.startContainer.data + ':' + range.startOffset + ', ' + range.endContainer.nodeName + ':' + range.endContainer.data + ':' + range.endOffset);

    var rangeStartNode = range.startContainer;
    var rangeStartOffset = range.startOffset;
    var rangeEndNode = range.endContainer;
    var rangeEndOffset = range.endOffset;


    if (range.startContainer.nodeName != '#text') {
        rangeStartNode = rangeStartNode.childNodes[rangeStartOffset];
        rangeStartOffset = 0;
    }
    if(range.endContainer.nodeName != '#text') {
        rangeEndNode = rangeEndNode.childNodes[rangeEndOffset];
        rangeEndOffset = 0;
    }

    var nodeInfos = [];
    var result = extractText(range.commonAncestorContainer, 0, 0, nodeInfos);

    var startPosition = null;
    var endPosition = null;

    while(nodeInfos.length) {
        var nodeInfo = nodeInfos.pop();
        if (nodeInfo.node == rangeStartNode) {
            startPosition = extractCursorPosition(nodeInfo, rangeStartOffset);

        }
        if (nodeInfo.node == rangeEndNode) {
            endPosition = extractCursorPosition(nodeInfo, rangeEndOffset);
        }

        if (startPosition != null && endPosition != null) {
            break;
        }
    }

    return { node: range.commonAncestorContainer, text: result.text, startPosition: startPosition, endPosition: endPosition };
};

var findNodeAndOffsetForCursor = function (node, line, column, targetLine, targetColumn, indent) {
    if(!indent) {
        indent = '';
    }
    //console.log(indent + node.nodeName + '@' + line + ':' + column + (node.nodeName == '#text' ? ':"' + node.data + '"': ''));
    if (node.nodeName == 'BR') {
        line++;
        column = 0;
        if (targetLine == line && targetColumn == column) {
            return { node: node.nextSibling, offset: 0, line: line, column: column };
        }
    }
    else if (node.nodeName == '#text') {
        var startColumn = column;
        if (node.data.length == 0 && targetLine == line && targetColumn == column) {
            return { node: node, offset: 0, line: line, column: column };
        }
        for (var c = 0; c < node.data.length; ++c) {
            if (targetLine == line && targetColumn == column) {
                return { node: node, offset: c, line: line, column: column };
            }
            if (node.data[c] == '\n') {
                line++;
                column = 0;
            }
            else {
                column++;
            }
        }
        if (targetLine == line && targetColumn == column) {
            return { node: node, offset: node.data.length, line: line, column: column };
        }
    }

    for (var i = 0; i < node.childNodes.length; ++i) {
        var child = node.childNodes[i];
        var result = findNodeAndOffsetForCursor(child, line, column, targetLine, targetColumn, indent + '  ');
        line = result.line;
        column = result.column;
        if (result.node != null) {
            return result;
        }
    }

    return { node: null, offset: -1, line: line, column: column };
}

var placeCursorInDom = function (node, startCursorPosition, endCursorPosition) {
    //console.log('Placing cursor on ' + startCursorPosition.line + ':' + startCursorPosition.column 
    //        + ',' + endCursorPosition.line + ':' + endCursorPosition.column);

    var startResult = findNodeAndOffsetForCursor(node, 0, 0, startCursorPosition.line, startCursorPosition.column);
    var endResult = findNodeAndOffsetForCursor(node, 0, 0, endCursorPosition.line, endCursorPosition.column);

    code.focus();
    var range = document.createRange();
    if (startResult.node != null && endResult.node != null) {
        range.setStart(startResult.node, startResult.offset);
        range.setEnd(endResult.node, endResult.offset);
        //console.log('New range: ' + range.startContainer.nodeName + ":\"" + range.startContainer.data + "\":" + range.startOffset);

    }
    else {
        //console.log('Did not find nodes, putting cursor at last element');
        range.selectNode(code.lastChild);
        range.collapse(false);
    }

    var sel = rangy.getSelection();
    sel.removeAllRanges();
    sel.addRange(range, selectingBackwards);
};

var highlight = function () {
    var textAndOffset = extractTextAndCursorPosition();
    //code.innerText = textAndOffset.text + '\n';
    buffer.innerHTML = textAndOffset.text;
    //console.log('Extracted text: "' + textAndOffset.text + '"');
    prettyPrint();
    var insertPoint = textAndOffset.node.parentNode;
    var block = document.createElement('span');
    while (buffer.childNodes.length) {
        var child = buffer.childNodes[0];
        buffer.removeChild(child);
        block.appendChild(child);
    }
    insertPoint.insertBefore(block, textAndOffset.node);
    insertPoint.removeChild(textAndOffset.node);
    placeCursorInDom(block, textAndOffset.startPosition, textAndOffset.endPosition);
};

var resetTimer = function () {
    if (timer) {
        clearTimeout(timer);
    }
    timer = setTimeout(function () { 
        timer = null; 
        highlight();

    }, 1000);
}

var timer = null;

var shiftMode = false;
var selectingBackwards = false;

var code = null;
var buffer = null;

window.onload = function() {
    code = document.getElementById('code');
    buffer = document.getElementById('buffer');
    code.onkeydown = function(e) {
        if (e.keyCode == 16) {
            shiftMode = true;
        }
        if (e.keyCode == 13) {
            var sel = rangy.getSelection();
            var range = sel.getRangeAt(0);
            var newSelectedNode = null;
            if (range.endContainer.nodeName == '#text' ) {
              // TODO: Handle case where cursor is not at end - see what Chrome
              // does
              var insertPoint = range.endContainer.parentNode;
              if (range.endContainer.nextSibling) {
                insertPoint.insertBefore(document.createTextNode('\n'), range.endContainer.nextSibling);
                newSelectedNode = document.createTextNode('\n');
                insertPoint.insertBefore(newSelectedNode, range.endContainer.nextSibling);
                
              }
              else {
                insertPoint.appendChild(document.createTextNode('\n'));
                newSelectedNode = document.createTextNode('\n');
                insertPoint.appendChild(newSelectedNode);
              }
              var newRange = rangy.createRange();
              newRange.setStart(newSelectedNode, 0);
              newRange.setEnd(newSelectedNode, 0);
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
            else {
              var node = range.endContainer.childNodes[range.endOffset];
              var insertPoint = node.parentNode;
              insertPoint.insertBefore(document.createTextNode('\n'), node);
            }
            e.preventDefault();
        }
    };

    code.onkeyup = function (e) {
        if (e.keyCode == 16) {
            shiftMode = false;
            selectingBackwards = false;
        }
        else if (shiftMode && (e.keyCode == 37 || e.keyCode == 38)) {
            selectingBackwards = true;
        }
        highlight();
    };

    code.focus();
}


