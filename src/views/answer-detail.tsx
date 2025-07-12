import { List } from "@raycast/api";
import { Chat } from "../type";

export const AnswerDetailView = (props: { chat: Chat; streamData?: Chat | undefined }) => {
  const { chat, streamData } = props;
  const isStreaming = streamData && streamData.id === chat.id;

  const width = Math.floor(430 / Math.min(Math.max(chat.files?.length ?? 0, 1), 2));

  const images: string =
    chat.files
      ?.map((file) => {
        const fileURI = encodeURI(`file://${file}?raycast-width=${width}`);
        return `![](${fileURI})`;
      })
      .join("\n") || "";

  const markdown = `### Answer\n\n${
    isStreaming ? streamData?.answer : chat.answer
  }\n\n### Question\n\n\`\`\`\n${chat.question.trimEnd()}\n\`\`\`\n\n${images ? "### Images\n\n" + images : ""}`;

  return <List.Item.Detail markdown={markdown} />;
};
