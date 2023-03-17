import { Api } from "../tl/api.js";
import { Handler, Parser } from "../deps.ts";

function stripText(text: string, entities: Api.TypeMessageEntity[]) {
  if (!entities || !entities.length) {
    return text.trim();
  }

  while (text && text[text.length - 1].trim() === "") {
    const e = entities[entities.length - 1];
    if (e.offset + e.length === text.length) {
      if (e.length === 1) {
        entities.pop();
        if (!entities.length) {
          return text.trim();
        }
      } else {
        e.length -= 1;
      }
    }
    text = text.slice(0, -1);
  }

  while (text && text[0].trim() === "") {
    for (let i = 0; i < entities.length; i++) {
      const e = entities[i];
      if (e.offset != 0) {
        e.offset--;
        continue;
      }
      if (e.length === 1) {
        entities.shift();
        if (!entities.length) {
          return text.trimLeft();
        }
      } else {
        e.length -= 1;
      }
    }
    text = text.slice(1);
  }
  return text;
}

class HTMLToTelegramParser implements Handler {
  text: string;
  entities: Api.TypeMessageEntity[];
  private readonly _buildingEntities: Map<string, Api.TypeMessageEntity>;
  private readonly _openTags: string[];
  private readonly _openTagsMeta: (string | undefined)[];

  constructor() {
    this.text = "";
    this.entities = [];
    this._buildingEntities = new Map<string, Api.TypeMessageEntity>();
    this._openTags = [];
    this._openTagsMeta = [];
  }

  onopentag(name: string, attributes: { [s: string]: string }) {
    this._openTags.unshift(name);
    this._openTagsMeta.unshift(undefined);
    let EntityType;
    // deno-lint-ignore no-explicit-any
    const args: any = {};
    if (name === "strong" || name === "b") {
      EntityType = Api.MessageEntityBold;
    } else if (name === "spoiler") {
      EntityType = Api.MessageEntitySpoiler;
    } else if (name === "em" || name === "i") {
      EntityType = Api.MessageEntityItalic;
    } else if (name === "u") {
      EntityType = Api.MessageEntityUnderline;
    } else if (name === "del" || name === "s") {
      EntityType = Api.MessageEntityStrike;
    } else if (name === "blockquote") {
      EntityType = Api.MessageEntityBlockquote;
    } else if (name === "code") {
      const pre = this._buildingEntities.get("pre");
      if (pre && pre instanceof Api.MessageEntityPre) {
        try {
          pre.language = attributes.class.slice(
            "language-".length,
            attributes.class.length,
          );
        } catch (_e) {
          // no language block
        }
      } else {
        EntityType = Api.MessageEntityCode;
      }
    } else if (name === "pre") {
      EntityType = Api.MessageEntityPre;
      args["language"] = "";
    } else if (name === "a") {
      let url: string | undefined = attributes.href;
      if (!url) {
        return;
      }
      if (url.startsWith("mailto:")) {
        url = url.slice("mailto:".length, url.length);
        EntityType = Api.MessageEntityEmail;
      } else {
        EntityType = Api.MessageEntityTextUrl;
        args["url"] = url;
        url = undefined;
      }
      this._openTagsMeta.shift();
      this._openTagsMeta.unshift(url);
    }

    if (EntityType && !this._buildingEntities.has(name)) {
      this._buildingEntities.set(
        name,
        new EntityType({
          offset: this.text.length,
          length: 0,
          ...args,
        }),
      );
    }
  }

  ontext(text: string) {
    const previousTag = this._openTags.length > 0 ? this._openTags[0] : "";
    if (previousTag === "a") {
      const url = this._openTagsMeta[0];
      if (url) text = url;
    }
    for (const [_tag, entity] of this._buildingEntities) {
      entity.length += text.length;
    }
    this.text += text;
  }

  onclosetag(tagname: string) {
    this._openTagsMeta.shift();
    this._openTags.shift();
    const entity = this._buildingEntities.get(tagname);
    if (entity) {
      this._buildingEntities.delete(tagname);
      this.entities.push(entity);
    }
  }

  onattribute(
    _name: string,
    _value: string,
    _quote?: string | undefined | null,
  ): void {}

  oncdataend(): void {}

  oncdatastart(): void {}

  oncomment(_data: string): void {}

  oncommentend(): void {}

  onend(): void {}

  onerror(_error: Error): void {}

  onopentagname(_name: string): void {}

  onparserinit(_parser: Parser): void {}

  onprocessinginstruction(_name: string, _data: string): void {}

  onreset(): void {}
}

export class HTMLParser {
  static parse(html: string): [string, Api.TypeMessageEntity[]] {
    if (!html) return [html, []];
    const handler = new HTMLToTelegramParser();
    const parser = new Parser(handler);
    parser.write(html);
    parser.end();
    const text = stripText(handler.text, handler.entities);
    return [text, handler.entities];
  }

  static unparse(
    text: string,
    entities: Api.TypeMessageEntity[] | undefined,
    _offset = 0,
    _length?: number,
  ): string {
    if (!text || !entities || !entities.length) {
      return text;
    }
    if (_length === undefined) {
      _length = text.length;
    }
    const html = [];
    let lastOffset = 0;
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (entity.offset >= _offset + _length) {
        break;
      }
      const relativeOffset = entity.offset - _offset;
      if (relativeOffset > lastOffset) {
        html.push(text.slice(lastOffset, relativeOffset));
      } else if (relativeOffset < lastOffset) {
        continue;
      }
      let skipEntity = false;
      const length = entity.length;
      const entityText = this.unparse(
        text.slice(relativeOffset, relativeOffset + length),
        entities.slice(i + 1, entities.length),
        entity.offset,
        length,
      );
      if (entity instanceof Api.MessageEntityBold) {
        html.push(`<strong>${entityText}</strong>`);
      } else if (entity instanceof Api.MessageEntitySpoiler) {
        html.push(`<spoiler>${entityText}</spoiler>`);
      } else if (entity instanceof Api.MessageEntityItalic) {
        html.push(`<em>${entityText}</em>`);
      } else if (entity instanceof Api.MessageEntityCode) {
        html.push(`<code>${entityText}</code>`);
      } else if (entity instanceof Api.MessageEntityUnderline) {
        html.push(`<u>${entityText}</u>`);
      } else if (entity instanceof Api.MessageEntityStrike) {
        html.push(`<del>${entityText}</del>`);
      } else if (entity instanceof Api.MessageEntityBlockquote) {
        html.push(`<blockquote>${entityText}</blockquote>`);
      } else if (entity instanceof Api.MessageEntityPre) {
        if (entity.language) {
          html.push(`<pre>
<code class="language-${entity.language}">
  ${entityText}
</code>
</pre>`);
        } else {
          html.push(`<pre></pre><code>${entityText}</code><pre>`);
        }
      } else if (entity instanceof Api.MessageEntityEmail) {
        html.push(`<a href="mailto:${entityText}">${entityText}</a>`);
      } else if (entity instanceof Api.MessageEntityUrl) {
        html.push(`<a href="${entityText}">${entityText}</a>`);
      } else if (entity instanceof Api.MessageEntityTextUrl) {
        html.push(`<a href="${entity.url}">${entityText}</a>`);
      } else if (entity instanceof Api.MessageEntityMentionName) {
        html.push(
          `<a href="tg://user?id=${entity.userId}">${entityText}</a>`,
        );
      } else {
        skipEntity = true;
      }
      lastOffset = relativeOffset + (skipEntity ? 0 : length);
    }
    html.push(text.slice(lastOffset, text.length));
    return html.join("");
  }
}
