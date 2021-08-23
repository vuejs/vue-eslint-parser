import type { Token } from "pug-lexer";
import lex from "pug-lexer";
import { debug } from "../common/debug";
import type { ParserOptions } from "../common/parser-options";

/**
 * Tokenizer for pug.
 */
export class Tokenizer {
  // Reading
  public readonly text: string;
  public readonly gaps: number[];
  public readonly lineTerminators: number[];
  public readonly tokens: Token[];
  // @ts-expect-error: should be used later
  private readonly parserOptions: ParserOptions;

  /**
   * Initialize this tokenizer.
   * @param text The source code to tokenize.
   * @param parserOptions The parser options.
   */
  public constructor(text: string, parserOptions?: ParserOptions) {
    debug("[pug] the source code length: %d", text.length);
    this.text = text;
    this.gaps = [];
    this.lineTerminators = [];
    this.parserOptions = parserOptions || {};

    this.tokens = lex(text);
  }
}
