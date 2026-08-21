// Transcript panel — shows what was heard and the interpreted command.
// Only visible to the operator (PRD §5.1).

interface Props {
  transcript: string | null;
  command: string | null;
}

export function TranscriptPanel({ transcript, command }: Props) {
  return (
    <section className="card transcript">
      <h2>Voz</h2>
      <div className="row">
        <span className="k">Transcripción</span>
        <span className="v">{transcript ?? "—"}</span>
      </div>
      <div className="row">
        <span className="k">Comando</span>
        <span className="v mono">{command ?? "—"}</span>
      </div>
    </section>
  );
}
