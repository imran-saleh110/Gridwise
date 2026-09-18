"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Textarea } from "@repo/ui/components/textarea";
import { FileText, Plus, Sparkles, Trash2 } from "lucide-react";

interface OperatorNotesInputProps {
  notes: string[];
  onChange: (notes: string[]) => void;
}

const TEMPLATES = [
  {
    label: "Solar Cleaning (-75%)",
    text: "Facilities will wash the rooftop solar panels from noon until 2 PM. Usable solar should be treated as roughly 25% of forecast.",
  },
  {
    label: "Charger Maint (02:00-05:00)",
    text: "The battery charger will be isolated from 2 AM until 5 AM for electrical maintenance.",
  },
  {
    label: "Grid Peak Cap (120 kW)",
    text: "Substation transformer maintenance: Cap grid import at 120 kWh per hour between 6 PM and 9 PM.",
  },
  {
    label: "Emergency Reserve (88 kWh)",
    text: "Grid stability drill: Keep at least 40% battery capacity reserved between 5 PM and 9 PM.",
  },
  {
    label: "No-Discharge Window",
    text: "Protect backup power: Do not discharge the battery between 8 AM and 11 AM.",
  },
  {
    label: "Unrelated Distractor",
    text: "The student council announced elections next Wednesday afternoon.",
  },
];

export function OperatorNotesInput({
  notes,
  onChange,
}: OperatorNotesInputProps) {
  const handleNoteChange = (index: number, value: string) => {
    const updated = [...notes];
    updated[index] = value;
    onChange(updated);
  };

  const handleAddNote = (initialText = "") => {
    if (notes.length < 3) {
      onChange([...notes, initialText]);
    }
  };

  const handleRemoveNote = (index: number) => {
    if (notes.length > 1) {
      onChange(notes.filter((_, i) => i !== index));
    }
  };

  return (
    <Card className="border-border bg-card shadow-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <CardTitle className="font-display text-base">
              Operator Directives & Notes
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="font-mono text-xs" variant="outline">
              {notes.length} / 3 Notes
            </Badge>
            <Button
              className="h-7 gap-1 border-border bg-secondary text-xs"
              disabled={notes.length >= 3}
              onClick={() => handleAddNote("")}
              size="sm"
              variant="outline"
            >
              <Plus className="size-3" />
              Add Note
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Notes Editor List */}
        <div className="space-y-3">
          {notes.map((note, index) => (
            <div
              className="relative rounded-lg border border-border bg-secondary/30 p-3 transition-all focus-within:border-primary/50"
              key={index}
            >
              <div className="flex items-center justify-between pb-1.5 text-xs">
                <span className="font-medium font-mono text-primary">
                  Note #{index}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {note.length} chars
                  </span>
                  {notes.length > 1 ? (
                    <Button
                      className="size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveNote(index)}
                      size="icon"
                      title="Remove note"
                      variant="ghost"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  ) : null}
                </div>
              </div>

              <Textarea
                className="min-h-[54px] resize-none border-border bg-background text-xs leading-relaxed"
                onChange={(e) => handleNoteChange(index, e.target.value)}
                placeholder="Enter operational directive in natural language..."
                rows={2}
                value={note}
              />
            </div>
          ))}
        </div>

        {/* Quick-Insert Directive Snippets */}
        <div className="border-border/40 border-t pt-2">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="size-3 text-primary" />
            <span>Quick Directives:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((tmpl) => (
              <button
                className="rounded border border-border/80 bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:bg-secondary hover:text-foreground"
                key={tmpl.label}
                onClick={() => {
                  if (notes.length < 3) {
                    handleAddNote(tmpl.text);
                  } else {
                    handleNoteChange(notes.length - 1, tmpl.text);
                  }
                }}
                type="button"
              >
                + {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
