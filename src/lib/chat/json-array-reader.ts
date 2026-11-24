/**
 * Reads a JSON array as it streams in, giving back each element once it's whole. YouTube's streamed chat comes
 * this way over HTTP: one array that stays open, an object added to it whenever there's something new.
 */
export class JsonArrayReader {
  private depth = 0;
  private inString = false;
  private escaped = false;
  private element = '';

  /** Takes the next piece of the text, and gives back the elements it finished. */
  push(chunk: string): unknown[] {
    const done: unknown[] = [];
    for (const char of chunk) {
      // Inside an element, everything is kept, the brackets that open and close it included
      if (this.depth >= 2) this.element += char;

      if (this.inString) {
        if (this.escaped) this.escaped = false;
        else if (char === '\\') this.escaped = true;
        else if (char === '"') this.inString = false;
        continue;
      }

      if (char === '"') this.inString = true;
      else if (char === '{' || char === '[') {
        this.depth++;
        if (this.depth === 2) this.element = char;
      } else if (char === '}' || char === ']') {
        this.depth--;
        if (this.depth === 1) {
          done.push(JSON.parse(this.element));
          this.element = '';
        }
      }
    }
    return done;
  }
}
