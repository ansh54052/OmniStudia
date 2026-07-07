import { createContext, useCallback, useContext, useMemo, useState } from "react";















const CompanionContext = createContext(undefined);

export function CompanionProvider({ children }) {
  const [document, setDocumentState] = useState(null);
  const [open, setOpen] = useState(false);

  const setDocument = useCallback((doc) => {
    setDocumentState((prev) => {
      if (doc) {
        const changed =
        !prev ||
        prev.id !== doc.id ||
        prev.text !== doc.text ||
        prev.title !== doc.title ||
        prev.filePath !== doc.filePath;
        if (changed) setOpen(true);
      } else {
        setOpen(false);
      }
      return doc;
    });
  }, [setOpen]);

  const value = useMemo(
    () => ({
      document,
      setDocument,
      open,
      setOpen
    }),
    [document, open, setDocument]
  );

  return <CompanionContext.Provider value={value}>{children}</CompanionContext.Provider>;
}

export function useCompanion() {
  const ctx = useContext(CompanionContext);
  if (!ctx) throw new Error("useCompanion must be used within a CompanionProvider");
  return ctx;
}