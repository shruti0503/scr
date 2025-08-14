import fs from "fs";
import path from "path";

export default function saveToFile(companyName, reviews) {
  const fileName = `${companyName.replace(/\s+/g, "_")}_reviews.json`;
  const filePath = path.join(process.cwd(), fileName);
  fs.writeFileSync(filePath, JSON.stringify(reviews, null, 2));
  return filePath;
}
