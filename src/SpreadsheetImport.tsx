import { useState, useRef } from "react";
import { useRaces } from "./RaceContext";
import type { Race, Boat } from "./RaceContext";
import type { BoatInfo, RaceBoatEntry } from "./api";
import * as XLSX from "xlsx";

// Fields the user can map columns to
const MAPPABLE_FIELDS = [
  { key: "name", label: "Boat Name", required: true },
  { key: "sailNumber", label: "Sail Number", required: false },
  { key: "class", label: "Class", required: false },
  { key: "type", label: "Boat Type", required: false },
  { key: "skipper", label: "Skipper", required: false },
  { key: "phrf", label: "PHRF Rating", required: false },
  { key: "portsmouthNumber", label: "Portsmouth Number", required: false },
  { key: "ircTcc", label: "IRC TCC", required: false },
] as const;

type FieldKey = (typeof MAPPABLE_FIELDS)[number]["key"];

interface ParsedRow {
  [key: string]: string;
}

type Step = "upload" | "map" | "preview" | "done";

export default function SpreadsheetImport({
  race,
  onDone,
}: {
  race: Race;
  onDone: () => void;
}) {
  const { boats, createBoat, updateRaceData, races } = useRaces();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({} as Record<FieldKey, string>);
  const [busy, setBusy] = useState(false);
  const [importCount, setImportCount] = useState(0);

  // ---- Step 1: Upload & parse ----

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (json.length === 0) return;

        const cols = Object.keys(json[0]);
        setHeaders(cols);
        setRows(json.map((row) => {
          const parsed: ParsedRow = {};
          cols.forEach((col) => { parsed[col] = String(row[col] ?? "").trim(); });
          return parsed;
        }));

        // Auto-map columns by guessing
        const autoMap: Record<string, string> = {};
        cols.forEach((col) => {
          const lower = col.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (lower.includes("boat") && lower.includes("name") || lower === "name" || lower === "boatname") {
            if (!autoMap.name) autoMap.name = col;
          }
          if (lower.includes("sail") || lower === "sailnumber" || lower === "sailno" || lower === "sail") {
            if (!autoMap.sailNumber) autoMap.sailNumber = col;
          }
          if (lower === "class" || lower === "division" || lower === "fleet" || lower === "classname") {
            if (!autoMap.class) autoMap.class = col;
          }
          if (lower === "type" || lower === "boattype" || lower === "model" || lower === "design") {
            if (!autoMap.type) autoMap.type = col;
          }
          if (lower === "skipper" || lower === "helm" || lower === "captain" || lower === "owner") {
            if (!autoMap.skipper) autoMap.skipper = col;
          }
          if (lower === "phrf" || lower === "phrfrating" || lower === "rating") {
            if (!autoMap.phrf) autoMap.phrf = col;
          }
          if (lower.includes("portsmouth") || lower === "pn" || lower === "py" || lower === "yardstick") {
            if (!autoMap.portsmouthNumber) autoMap.portsmouthNumber = col;
          }
          if (lower === "irc" || lower === "irctcc" || lower === "tcc") {
            if (!autoMap.ircTcc) autoMap.ircTcc = col;
          }
        });
        setMapping(autoMap as Record<FieldKey, string>);
        setStep("map");
      } catch (err) {
        console.error("Failed to parse file:", err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // ---- Step 2: Column mapping ----

  const setFieldMapping = (field: FieldKey, col: string) => {
    setMapping((prev) => ({ ...prev, [field]: col }));
  };

  const nameColumn = mapping.name;
  const canProceed = !!nameColumn;

  // ---- Step 3: Preview & import ----

  const getMappedValue = (row: ParsedRow, field: FieldKey): string => {
    const col = mapping[field];
    if (!col) return "";
    return row[col] || "";
  };

  const previewRows = rows.map((row) => ({
    name: getMappedValue(row, "name"),
    sailNumber: getMappedValue(row, "sailNumber"),
    class: getMappedValue(row, "class") || "Default",
    type: getMappedValue(row, "type"),
    skipper: getMappedValue(row, "skipper"),
    phrf: getMappedValue(row, "phrf"),
    portsmouthNumber: getMappedValue(row, "portsmouthNumber"),
    ircTcc: getMappedValue(row, "ircTcc"),
  })).filter((r) => r.name.trim() !== "");

  const doImport = async () => {
    setBusy(true);
    // Get fresh race data
    const currentRace = races.find((r) => r.id === race.id) || race;
    const existingBoats = currentRace.info.boats || [];
    const existingBoatIds = existingBoats.map((b) => b.boatId);
    let newBoatEntries: RaceBoatEntry[] = [...existingBoats];
    let added = 0;

    for (const row of previewRows) {
      // Try to match existing boat by name or sail number
      let existingBoat: Boat | undefined;
      if (row.sailNumber) {
        existingBoat = boats.find((b) =>
          b.info.sailNumber?.toLowerCase() === row.sailNumber.toLowerCase()
        );
      }
      if (!existingBoat) {
        existingBoat = boats.find((b) =>
          b.name.toLowerCase() === row.name.toLowerCase()
        );
      }

      let boatId: number;

      if (existingBoat && existingBoatIds.includes(existingBoat.id)) {
        // Already in this race — skip
        continue;
      } else if (existingBoat) {
        // Exists in database but not in this race
        boatId = existingBoat.id;
      } else {
        // Create new boat
        const info: BoatInfo = { name: row.name };
        if (row.sailNumber) info.sailNumber = row.sailNumber;
        if (row.type) info.type = row.type;
        if (row.skipper) info.skipper = row.skipper;
        if (row.phrf && !isNaN(Number(row.phrf))) info.phrf = Number(row.phrf);
        if (row.portsmouthNumber && !isNaN(Number(row.portsmouthNumber))) info.portsmouthNumber = Number(row.portsmouthNumber);
        if (row.ircTcc && !isNaN(Number(row.ircTcc))) info.ircTcc = Number(row.ircTcc);

        const newBoat = await createBoat(row.name, info);
        boatId = newBoat.id;
      }

      const entry: RaceBoatEntry = {
        boatId,
        class: row.class,
        status: currentRace.info.autoCheckIn ? "checked-in" : "signed-up",
      };
      newBoatEntries.push(entry);
      existingBoatIds.push(boatId);
      added++;
    }

    // Update race with all new boats
    updateRaceData(currentRace.id, currentRace.name, {
      ...currentRace.info,
      boats: newBoatEntries,
    });

    setImportCount(added);
    setBusy(false);
    setStep("done");
  };

  // ---- Render ----

  if (step === "upload") {
    return (
      <div className="races-form">
        <div className="import-upload-area" onClick={() => fileRef.current?.click()}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Tap to select a spreadsheet</span>
          <span className="import-upload-hint">.csv, .xlsx, or .xls</span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleFile}
        />
        <button className="btn btn-secondary" onClick={onDone}>Cancel</button>
      </div>
    );
  }

  if (step === "map") {
    return (
      <div className="races-form">
        <div className="import-map-title">
          {rows.length} row{rows.length !== 1 ? "s" : ""} found — map columns:
        </div>
        {MAPPABLE_FIELDS.map((field) => (
          <div key={field.key} className="import-map-row">
            <span className="import-map-label">
              {field.label}
              {field.required && <span className="import-required"> *</span>}
            </span>
            <select
              className="import-map-select"
              value={mapping[field.key] || ""}
              onChange={(e) => setFieldMapping(field.key, e.target.value)}
            >
              <option value="">— skip —</option>
              {headers.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
        <div className="races-form-actions">
          <button
            className="btn btn-primary"
            disabled={!canProceed}
            onClick={() => setStep("preview")}
          >
            Preview
          </button>
          <button className="btn btn-secondary" onClick={() => setStep("upload")}>Back</button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <div className="races-form">
        <div className="import-map-title">
          {previewRows.length} boat{previewRows.length !== 1 ? "s" : ""} to import:
        </div>
        <div className="import-preview-list">
          {previewRows.map((row, i) => (
            <div key={i} className="import-preview-row">
              <span className="import-preview-name">{row.name}</span>
              <span className="import-preview-detail">
                {[row.sailNumber, row.class, row.type].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))}
        </div>
        <div className="races-form-actions">
          <button
            className="btn btn-primary"
            disabled={busy || previewRows.length === 0}
            onClick={doImport}
          >
            {busy ? "Importing..." : `Import ${previewRows.length} Boats`}
          </button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => setStep("map")}>Back</button>
        </div>
      </div>
    );
  }

  // done
  return (
    <div className="races-form">
      <div className="import-done">
        <span className="import-done-count">{importCount}</span>
        <span>boat{importCount !== 1 ? "s" : ""} imported successfully</span>
      </div>
      <button className="btn btn-primary" onClick={onDone}>Done</button>
    </div>
  );
}
