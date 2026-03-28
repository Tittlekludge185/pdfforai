// Core model classes for PDF to Markdown conversion

import type { BlockTypeDef, WordFormatDef, WordTypeDef } from "./markdown.js";
import { WordFormat, WordType } from "./markdown.js";
import { isNumber, isListItemCharacter, sortByX, normalizedCharCodeArray } from "./utils.js";

// Annotation
export interface Annotation {
  category: string;
  color: string;
}

export const ADDED_ANNOTATION: Annotation = { category: "Added", color: "green" };
export const REMOVED_ANNOTATION: Annotation = { category: "Removed", color: "red" };
export const UNCHANGED_ANNOTATION: Annotation = { category: "Unchanged", color: "brown" };
export const DETECTED_ANNOTATION: Annotation = { category: "Detected", color: "green" };
export const MODIFIED_ANNOTATION: Annotation = { category: "Modified", color: "green" };

// ParsedElements
export interface ParsedElements {
  footnoteLinks: number[];
  footnotes: string[];
  containLinks: boolean;
  formattedWords: number;
}

export function createParsedElements(opts?: Partial<ParsedElements>): ParsedElements {
  return {
    footnoteLinks: opts?.footnoteLinks || [],
    footnotes: opts?.footnotes || [],
    containLinks: opts?.containLinks || false,
    formattedWords: opts?.formattedWords || 0,
  };
}

function addParsedElements(target: ParsedElements, source: ParsedElements): void {
  target.footnoteLinks = target.footnoteLinks.concat(source.footnoteLinks);
  target.footnotes = target.footnotes.concat(source.footnotes);
  target.containLinks = target.containLinks || source.containLinks;
  target.formattedWords += source.formattedWords;
}

// Word
export interface WordData {
  string: string;
  type?: WordTypeDef | null;
  format?: WordFormatDef | null;
}

// TextItem - a text item from PDF parsing
export interface TextItemData {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  font: string;
  type?: BlockTypeDef | null;
  annotation?: Annotation | null;
  parsedElements?: ParsedElements | null;
}

// LineItem - a line within a page (compacted from TextItems)
export interface LineItemData {
  x: number;
  y: number;
  width: number;
  height: number;
  words: WordData[];
  type?: BlockTypeDef | null;
  annotation?: Annotation | null;
  parsedElements?: ParsedElements | null;
  font?: string;
}

export function lineItemText(item: LineItemData): string {
  return item.words.map((w) => w.string).join(" ");
}

// LineItemBlock - a block of LineItems
export interface LineItemBlockData {
  items: LineItemData[];
  type?: BlockTypeDef | null;
  annotation?: Annotation | null;
  parsedElements?: ParsedElements | null;
}

export function createLineItemBlock(): LineItemBlockData {
  return { items: [] };
}

export function addItemToBlock(block: LineItemBlockData, item: LineItemData): void {
  if (block.type && item.type && block.type !== item.type) {
    return;
  }
  if (!block.type) {
    block.type = item.type;
  }
  if (item.parsedElements) {
    if (block.parsedElements) {
      addParsedElements(block.parsedElements, item.parsedElements);
    } else {
      block.parsedElements = { ...item.parsedElements };
    }
  }
  const copiedItem: LineItemData = {
    ...item,
    type: null,
  };
  block.items.push(copiedItem);
}

// Page
export interface PageData {
  index: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
}

// ParseResult - wraps pages + globals + messages through transformations
export interface ParseResult {
  pages: PageData[];
  globals: GlobalStats;
  messages: string[];
}

export interface GlobalStats {
  mostUsedHeight?: number;
  mostUsedFont?: string;
  mostUsedDistance?: number;
  maxHeight?: number;
  maxHeightFont?: string;
  fontToFormats?: Map<string, string>;
  tocPages?: number[];
  headlineTypeToHeightRange?: Record<string, { min: number; max: number }>;
}

// StashingStream - abstract buffering stream pattern
export abstract class StashingStream<T, R> {
  results: R[] = [];
  stash: T[] = [];

  consumeAll(items: T[]): void {
    items.forEach((item) => this.consume(item));
  }

  consume(item: T): void {
    if (this.shouldStash(item)) {
      if (!this.matchesStash(item)) {
        this.flushStash();
      }
      this.pushOnStash(item);
    } else {
      if (this.stash.length > 0) {
        this.flushStash();
      }
      this.results.push(item as unknown as R);
    }
  }

  pushOnStash(item: T): void {
    this.onPushOnStash(item);
    this.stash.push(item);
  }

  complete(): R[] {
    if (this.stash.length > 0) {
      this.flushStash();
    }
    return this.results;
  }

  matchesStash(item: T): boolean {
    if (this.stash.length === 0) {
      return true;
    }
    const lastItem = this.stash[this.stash.length - 1];
    return this.doMatchesStash(lastItem, item);
  }

  flushStash(): void {
    if (this.stash.length > 0) {
      this.doFlushStash(this.stash, this.results);
      this.stash = [];
    }
  }

  onPushOnStash(_item: T): void {
    // sub-classes may override
  }

  abstract shouldStash(item: T): boolean;
  abstract doMatchesStash(lastItem: T, item: T): boolean;
  abstract doFlushStash(stash: T[], results: R[]): void;
}

// HeadlineFinder - matches TOC entries to actual headline text
export class HeadlineFinder {
  private headlineCharCodes: number[];
  private stackedLineItems: LineItemData[] = [];
  private stackedChars = 0;

  constructor(headline: string) {
    this.headlineCharCodes = normalizedCharCodeArray(headline);
  }

  consume(lineItem: LineItemData): LineItemData[] | null {
    const normalizedCharCodes = normalizedCharCodeArray(lineItemText(lineItem));
    const matchAll = this.matchAll(normalizedCharCodes);
    if (matchAll) {
      this.stackedLineItems.push(lineItem);
      this.stackedChars += normalizedCharCodes.length;
      if (this.stackedChars === this.headlineCharCodes.length) {
        return this.stackedLineItems;
      }
    } else {
      if (this.stackedChars > 0) {
        this.stackedChars = 0;
        this.stackedLineItems = [];
        this.consume(lineItem);
      }
    }
    return null;
  }

  private matchAll(normalizedCharCodes: number[]): boolean {
    for (let i = 0; i < normalizedCharCodes.length; i++) {
      const headlineChar = this.headlineCharCodes[this.stackedChars + i];
      const textItemChar = normalizedCharCodes[i];
      if (textItemChar !== headlineChar) {
        return false;
      }
    }
    return true;
  }
}

// TextItemLineGrouper - groups text items on same Y coordinate into lines
export class TextItemLineGrouper {
  private mostUsedDistance: number;

  constructor(mostUsedDistance: number) {
    this.mostUsedDistance = mostUsedDistance || 12;
  }

  group(textItems: TextItemData[]): TextItemData[][] {
    const lines: TextItemData[][] = [];
    let currentLine: TextItemData[] = [];
    const orderedTextItems = [...textItems].sort((a, b) => {
      if (a.y !== b.y) {
        return b.y - a.y;
      }
      return a.x - b.x;
    });

    orderedTextItems.forEach((item) => {
      if (
        currentLine.length > 0 &&
        Math.abs(currentLine[0].y - item.y) >= this.mostUsedDistance / 2
      ) {
        lines.push(currentLine);
        currentLine = [];
      }
      currentLine.push(item);
    });
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    lines.forEach((lineItems) => {
      sortByX(lineItems);
    });
    return lines;
  }
}

// WordDetectionStream - used by LineConverter to detect word types
class WordDetectionStream extends StashingStream<TextItemData, WordData> {
  fontToFormats: Map<string, string>;
  footnoteLinks: number[] = [];
  footnotes: string[] = [];
  formattedWords = 0;
  containLinks = false;

  private firstY: number | undefined;
  private stashedNumber = false;
  private currentItem: TextItemData | undefined;

  constructor(fontToFormats: Map<string, string>) {
    super();
    this.fontToFormats = fontToFormats;
  }

  shouldStash(_item: TextItemData): boolean {
    if (!this.firstY) {
      this.firstY = _item.y;
    }
    this.currentItem = _item;
    return true;
  }

  onPushOnStash(item: TextItemData): void {
    this.stashedNumber = isNumber(item.text.trim());
  }

  doMatchesStash(lastItem: TextItemData, item: TextItemData): boolean {
    const lastItemFormat = this.fontToFormats.get(lastItem.font);
    const itemFormat = this.fontToFormats.get(item.font);
    if (lastItemFormat !== itemFormat) {
      return false;
    }
    const itemIsANumber = isNumber(item.text.trim());
    return this.stashedNumber === itemIsANumber;
  }

  doFlushStash(stash: TextItemData[], results: WordData[]): void {
    if (this.stashedNumber) {
      const joinedNumber = stash.map((item) => item.text).join("").trim();
      if (this.firstY !== undefined && stash[0].y > this.firstY) {
        results.push({
          string: `${joinedNumber}`,
          type: WordType.FOOTNOTE_LINK,
        });
        this.footnoteLinks.push(parseInt(joinedNumber));
      } else if (
        this.currentItem &&
        this.currentItem.y < stash[0].y
      ) {
        results.push({
          string: `${joinedNumber}`,
          type: WordType.FOOTNOTE,
        });
        this.footnotes.push(joinedNumber);
      } else {
        this.copyStashItemsAsText(stash, results);
      }
    } else {
      this.copyStashItemsAsText(stash, results);
    }
  }

  private copyStashItemsAsText(stash: TextItemData[], results: WordData[]): void {
    const formatName = this.fontToFormats.get(stash[0].font);
    results.push(...this.itemsToWords(stash, formatName));
  }

  private itemsToWords(
    items: TextItemData[],
    formatName?: string
  ): WordData[] {
    const combinedText = combineText(items);
    const words = combinedText.split(" ");
    const format = formatName ? WordFormat.enumValueOf(formatName) : null;
    return words
      .filter((w) => w.trim().length > 0)
      .map((word) => {
        let type: WordTypeDef | null = null;
        let wordStr = word;
        if (word.startsWith("http:") || word.startsWith("https:")) {
          this.containLinks = true;
          type = WordType.LINK;
        } else if (word.startsWith("www.")) {
          this.containLinks = true;
          wordStr = `http://${word}`;
          type = WordType.LINK;
        }

        if (format) {
          this.formattedWords++;
        }
        return {
          string: wordStr,
          type: type,
          format: format,
        };
      });
  }
}

function combineText(textItems: TextItemData[]): string {
  let text = "";
  let lastItem: TextItemData | undefined;
  textItems.forEach((textItem) => {
    let textToAdd = textItem.text;
    if (!text.endsWith(" ") && !textToAdd.startsWith(" ")) {
      if (lastItem) {
        const xDistance = textItem.x - lastItem.x - lastItem.width;
        const avgHeight = (lastItem.height + textItem.height) / 2 || 12;
        const spaceThreshold = Math.max(avgHeight * 0.15, 1);
        if (xDistance > spaceThreshold) {
          text += " ";
        }
      } else {
        if (isListItemCharacter(textItem.text)) {
          textToAdd += " ";
        }
      }
    }
    text += textToAdd;
    lastItem = textItem;
  });
  return text;
}

// LineConverter - converts grouped TextItems into a single LineItem
export class LineConverter {
  private fontToFormats: Map<string, string>;

  constructor(fontToFormats: Map<string, string>) {
    this.fontToFormats = fontToFormats;
  }

  compact(textItems: TextItemData[]): LineItemData {
    sortByX(textItems);

    const wordStream = new WordDetectionStream(this.fontToFormats);
    wordStream.consumeAll(textItems.map((item) => ({ ...item })));
    const words = wordStream.complete();

    let maxHeight = 0;
    let widthSum = 0;
    const fontToCount: Record<string, number> = {};
    textItems.forEach((item) => {
      maxHeight = Math.max(maxHeight, item.height);
      widthSum += item.width;
      fontToCount[item.font] = (fontToCount[item.font] || 0) + 1;
    });

    let dominantFont = textItems[0].font;
    let dominantCount = 0;
    Object.entries(fontToCount).forEach(([font, count]) => {
      if (count > dominantCount) {
        dominantFont = font;
        dominantCount = count;
      }
    });

    return {
      x: textItems[0].x,
      y: textItems[0].y,
      height: maxHeight,
      width: widthSum,
      font: dominantFont,
      words: words,
      parsedElements: createParsedElements({
        footnoteLinks: wordStream.footnoteLinks,
        footnotes: wordStream.footnotes,
        containLinks: wordStream.containLinks,
        formattedWords: wordStream.formattedWords,
      }),
    };
  }
}
