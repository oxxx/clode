# TODO for Clode

 * Handle paste event and paste sane data (avoid BRs etc)
 * Fix line breaks when line should be cut (use Chrome behavior as guide)
 * Cross-browser compatibility:
   - IE9/Win: Cursor jump on backspace at start of line
   - IE9/Win: Cursor jump on arrow key navigation
   - IE9/Win: Cursor jump on multiple line breaks/backspace through them
   - IE9/Win: Leftwards select does not work
   - FF/Win,Mac: Error on backspace at start of line (startCursorPosition is
     null) - causes jump to end of first line
   - Test on Safari/Win, Opera/Win, FF/Mac, */Linux
