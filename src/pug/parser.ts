import type { Token } from "pug-lexer";
import type { VDocumentFragment } from "../ast";
import { ParseError } from "../ast";
import type { ParserOptions } from "../common/parser-options";
import { isSFCFile } from "../common/parser-options";
import type { Tokenizer } from "./tokenizer";

/**
 * Parser for pug.
 */
export class Parser {
  private tokenizer: Tokenizer;
  // @ts-expect-error: should be used later
  private baseParserOptions: ParserOptions;
  // @ts-expect-error: should be used later
  private isSFC: boolean;
  private document: VDocumentFragment;

  /**
   * The tokens.
   */
  private get tokens(): Token[] {
    return this.tokenizer.tokens;
  }

  /**
   * The comments.
   */
  private get comments(): Token[] {
    return [];
    // return this.tokenizer.comments;
  }

  /**
   * The syntax errors which are found in this parsing.
   */
  private get errors(): ParseError[] {
    return [];
    // return this.tokenizer.errors;
  }

  public constructor(tokenizer: Tokenizer, parserOptions: ParserOptions) {
    this.tokenizer = tokenizer;
    this.baseParserOptions = parserOptions;
    this.isSFC = isSFCFile(parserOptions);
    this.document = {
      type: "VDocumentFragment",
      range: [0, 0],
      loc: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
      parent: null,
      children: [],
      tokens: this.tokens as any[],
      comments: this.comments as any[],
      errors: this.errors,
    };
  }

  public parse(): VDocumentFragment {
    return this.document;
  }
}
