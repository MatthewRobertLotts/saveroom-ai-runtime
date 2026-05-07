import { save_artifact } from "./tool-executor";

function main() {
  const result1 = save_artifact("Todd", "stream/title.txt", "Stream marketing title");
  const result2 = save_artifact("Todd", "stream/instagram-caption.txt", "Instagram caption");
  const result3 = save_artifact("Todd", "stream/discord-announcement.txt", "Discord announcement");
  const result4 = save_artifact("Todd", "stream/bundle-ideas.txt", "Bundle ideas");

  console.log(JSON.stringify([result1, result2, result3, result4], null, 2));
}

main();
