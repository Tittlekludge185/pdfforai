// Markdown types: BlockType, WordType, WordFormat

import type { LineItemData, LineItemBlockData, WordData } from "./models.js";

// WordFormat - The format of a word element
export interface WordFormatDef {
  name: string;
  startSymbol: string;
  endSymbol: string;
}

export const WordFormat = {
  BOLD: { name: "BOLD", startSymbol: "**", endSymbol: "**" } as WordFormatDef,
  OBLIQUE: { name: "OBLIQUE", startSymbol: "_", endSymbol: "_" } as WordFormatDef,
  BOLD_OBLIQUE: {
    name: "BOLD_OBLIQUE",
    startSymbol: "**_",
    endSymbol: "_**",
  } as WordFormatDef,

  enumValueOf(name: string): WordFormatDef | null {
    switch (name) {
      case "BOLD":
        return WordFormat.BOLD;
      case "OBLIQUE":
        return WordFormat.OBLIQUE;
      case "BOLD_OBLIQUE":
        return WordFormat.BOLD_OBLIQUE;
      default:
        return null;
    }
  },
};

// WordType - A markdown word element type
export interface WordTypeDef {
  name: string;
  attachWithoutWhitespace?: boolean;
  plainTextFormat?: boolean;
  toText: (string: string) => string;
}

export const WordType = {
  LINK: {
    name: "LINK",
    toText(string: string) {
      return `[${string}](${string})`;
    },
  } as WordTypeDef,
  FOOTNOTE_LINK: {
    name: "FOOTNOTE_LINK",
    attachWithoutWhitespace: true,
    plainTextFormat: true,
    toText(string: string) {
      return `^${string}`;
    },
  } as WordTypeDef,
  FOOTNOTE: {
    name: "FOOTNOTE",
    toText(string: string) {
      return `(^${string})`;
    },
  } as WordTypeDef,
};

function isPunctuationCharacter(string: string): boolean {
  if (string.length !== 1) {
    return false;
  }
  return string[0] === "." || string[0] === "!" || string[0] === "?";
}

function firstFormat(lineItem: LineItemData): WordFormatDef | null {
  if (lineItem.words.length === 0) {
    return null;
  }
  return lineItem.words[0].format || null;
}

export function linesToText(
  lineItems: LineItemData[],
  disableInlineFormats: boolean
): string {
  let text = "";
  let openFormat: WordFormatDef | null = null;

  const closeFormat = () => {
    if (openFormat) {
      text += openFormat.endSymbol;
      openFormat = null;
    }
  };

  lineItems.forEach((line, lineIndex) => {
    line.words.forEach((word: WordData, i: number) => {
      const wordType = word.type;
      const wordFormat = word.format;
      if (openFormat && (!wordFormat || wordFormat !== openFormat)) {
        closeFormat();
      }

      if (
        i > 0 &&
        !(wordType && wordType.attachWithoutWhitespace) &&
        !isPunctuationCharacter(word.string)
      ) {
        text += " ";
      }

      if (wordFormat && !openFormat && !disableInlineFormats) {
        openFormat = wordFormat;
        text += openFormat.startSymbol;
      }

      if (wordType && (!disableInlineFormats || wordType.plainTextFormat)) {
        text += wordType.toText(word.string);
      } else {
        text += word.string;
      }
    });
    if (
      openFormat &&
      (lineIndex === lineItems.length - 1 ||
        firstFormat(lineItems[lineIndex + 1]) !== openFormat)
    ) {
      closeFormat();
    }
    text += "\n";
  });
  return text;
}

// BlockType - A markdown block type
export interface BlockTypeDef {
  name: string;
  headline?: boolean;
  headlineLevel?: number;
  mergeToBlock?: boolean;
  mergeFollowingNonTypedItems?: boolean;
  mergeFollowingNonTypedItemsWithSmallDistance?: boolean;
  toText: (block: LineItemBlockData) => string;
}

export const BlockType: Record<string, BlockTypeDef> = {
  H1: {
    name: "H1",
    headline: true,
    headlineLevel: 1,
    toText(block: LineItemBlockData) {
      return "# " + linesToText(block.items, true);
    },
  },
  H2: {
    name: "H2",
    headline: true,
    headlineLevel: 2,
    toText(block: LineItemBlockData) {
      return "## " + linesToText(block.items, true);
    },
  },
  H3: {
    name: "H3",
    headline: true,
    headlineLevel: 3,
    toText(block: LineItemBlockData) {
      return "### " + linesToText(block.items, true);
    },
  },
  H4: {
    name: "H4",
    headline: true,
    headlineLevel: 4,
    toText(block: LineItemBlockData) {
      return "#### " + linesToText(block.items, true);
    },
  },
  H5: {
    name: "H5",
    headline: true,
    headlineLevel: 5,
    toText(block: LineItemBlockData) {
      return "##### " + linesToText(block.items, true);
    },
  },
  H6: {
    name: "H6",
    headline: true,
    headlineLevel: 6,
    toText(block: LineItemBlockData) {
      return "###### " + linesToText(block.items, true);
    },
  },
  TOC: {
    name: "TOC",
    mergeToBlock: true,
    toText(block: LineItemBlockData) {
      return linesToText(block.items, true);
    },
  },
  FOOTNOTES: {
    name: "FOOTNOTES",
    mergeToBlock: true,
    mergeFollowingNonTypedItems: true,
    toText(block: LineItemBlockData) {
      return linesToText(block.items, false);
    },
  },
  CODE: {
    name: "CODE",
    mergeToBlock: true,
    toText(block: LineItemBlockData) {
      return "```\n" + linesToText(block.items, true) + "```";
    },
  },
  LIST: {
    name: "LIST",
    mergeToBlock: true,
    mergeFollowingNonTypedItemsWithSmallDistance: true,
    toText(block: LineItemBlockData) {
      return linesToText(block.items, false);
    },
  },
  PARAGRAPH: {
    name: "PARAGRAPH",
    toText(block: LineItemBlockData) {
      return linesToText(block.items, false);
    },
  },
};

export function blockToText(block: LineItemBlockData): string {
  if (!block.type) {
    return linesToText(block.items, false);
  }
  return block.type.toText(block);
}

export function headlineByLevel(level: number): BlockTypeDef {
  if (level >= 1 && level <= 6) {
    return BlockType[`H${level}`];
  }
  throw new Error("Unsupported headline level: " + level + " (supported are 1-6)");
}
