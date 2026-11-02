// Tile 8: three of the Opener's people ask (Mum, Kelvin (Agent), Daniel Koh), then Kaplan 360++ answers
// "Don't answer yet. Look first." 8s loop. Every string comes translated. `centred`: the stack in the middle of
// the picture rather than at its foot (the wide first tile).

export function ChatsVisual({ chats, reply, centred = false }: { chats: { who: string; text: string }[]; reply: { who: string; text: string }; centred?: boolean }) {
  return (
    <div className={centred ? "hb-v hb-chats hb-chats-centred" : "hb-v hb-chats"}>
      {chats.map((c, i) => (
        <p key={c.who} className={`hb-chat hb-chat-${i + 1}`} style={{ animationDelay: `${i * 0.7}s` }}>
          <b>{c.who}</b> {c.text}
        </p>
      ))}
      <p className="hb-chat hb-chat-reply">
        <b>{reply.who}</b> {reply.text}
      </p>
    </div>
  );
}
