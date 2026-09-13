import { COPYRIGHT_TEXT } from "../constants";
import "./site-footer.css";

// 站点页脚:版权标识(文案来自 constants.COPYRIGHT_TEXT,占位主体见该常量的 TODO)。
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>{COPYRIGHT_TEXT}</span>
    </footer>
  );
}
