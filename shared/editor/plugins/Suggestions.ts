import { EditorState, Plugin } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import type { Editor } from "../../../app/editor";
import { EventType } from "../types";

const MAX_MATCH = 500;

export enum SuggestionsMenuType {
  Emoji = "emoji",
  Block = "block",
  Mention = "mention",
}

type Options = {
  type: SuggestionsMenuType;
  openRegex: RegExp;
  closeRegex: RegExp;
  enabledInCode: true;
  enabledInTable: true;
};

export class SuggestionsMenuPlugin extends Plugin {
  constructor(editor: Editor, options: Options) {
    super({
      props: {
        handleClick: () => {
          editor.events.emit(options.type);
          return false;
        },
        handleKeyDown: (view, event) => {
          // Prosemirror input rules are not triggered on backspace, however
          // we need them to be evaluted for the filter trigger to work
          // correctly. This additional handler adds inputrules-like handling.
          if (event.key === "Backspace") {
            // timeout ensures that the delete has been handled by prosemirror
            // and any characters removed, before we evaluate the rule.
            setTimeout(() => {
              const { pos } = view.state.selection.$from;
              return this.execute(
                view,
                pos,
                pos,
                options.openRegex,
                (state, match) => {
                  if (match) {
                    editor.events.emit(EventType.SuggestionsMenuOpen, {
                      type: options.type,
                      query: match[1],
                    });
                  } else {
                    editor.events.emit(
                      EventType.SuggestionsMenuClose,
                      options.type
                    );
                  }
                  return null;
                }
              );
            });
          }

          const { pos } = view.state.selection.$from;

          // If the query is active and we're navigating the block menu then
          // just ignore the key events in the editor itself until we're done
          if (
            event.key === "Enter" ||
            event.key === "ArrowUp" ||
            event.key === "ArrowDown" ||
            event.key === "Tab"
          ) {
            return this.execute(
              view,
              pos,
              pos,
              options.openRegex,
              (state, match) =>
                // just tell Prosemirror we handled it and not to do anything
                match ? true : null
            );
          }

          return false;
        },
      },
    });
  }

  // based on the input rules code in Prosemirror, here:
  // https://github.com/ProseMirror/prosemirror-inputrules/blob/master/src/inputrules.js
  private execute(
    view: EditorView,
    from: number,
    to: number,
    regex: RegExp,
    handler: (
      state: EditorState,
      match: RegExpExecArray | null,
      from?: number,
      to?: number
    ) => boolean | null
  ) {
    if (view.composing) {
      return false;
    }
    const state = view.state;
    const $from = state.doc.resolve(from);
    if ($from.parent.type.spec.code) {
      return false;
    }

    const textBefore = $from.parent.textBetween(
      Math.max(0, $from.parentOffset - MAX_MATCH),
      $from.parentOffset,
      undefined,
      "\ufffc"
    );

    const match = regex.exec(textBefore);
    const tr = handler(state, match, match ? from - match[0].length : from, to);
    if (!tr) {
      return false;
    }
    return true;
  }
}