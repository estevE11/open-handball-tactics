import { Languages } from "lucide-react";
import {
  useLanguageStore,
  useTranslation,
  type Language,
} from "../../lib/i18n";

export function LanguageSelect() {
  const t = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  return (
    <label className="language-setting">
      <span>
        <Languages size={17} /> {t("Language")}
      </span>
      <select
        aria-label={t("Interface language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="en" lang="en">
          English
        </option>
        <option value="es" lang="es">
          Español
        </option>
      </select>
    </label>
  );
}
