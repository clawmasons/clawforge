import * as fs from "node:fs";
import * as path from "node:path";
import * as Y from "yjs";

export class FilePersistence {
  private filePath: string;
  private doc: Y.Doc;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;

  constructor(filePath: string, doc: Y.Doc) {
    this.filePath = filePath;
    this.doc = doc;

    doc.on("update", () => {
      this.dirty = true;
      this.debouncedSave();
    });
  }

  load(): void {
    if (!fs.existsSync(this.filePath)) {
      console.log(`[persistence] No existing file at ${this.filePath}, starting fresh`);
      return;
    }
    const data = fs.readFileSync(this.filePath);
    Y.applyUpdate(this.doc, new Uint8Array(data));
    console.log(`[persistence] Loaded document from ${this.filePath}`);
  }

  private debouncedSave(): void {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      if (this.dirty) {
        this.saveNow();
      }
    }, 1000);
  }

  private saveNow(): void {
    const update = Y.encodeStateAsUpdate(this.doc);
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Atomic write: write to tmp file then rename
    const tmpPath = this.filePath + ".tmp";
    fs.writeFileSync(tmpPath, Buffer.from(update));
    fs.renameSync(tmpPath, this.filePath);
    this.dirty = false;
    console.log(`[persistence] Saved document to ${this.filePath}`);
  }

  flush(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.dirty) {
      this.saveNow();
    }
  }
}
