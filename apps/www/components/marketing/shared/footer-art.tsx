export function FooterArt() {
  const items = Array.from({ length: 24 }, (_, index) => ({
    id: `footer-art-bar-${index}`,
    marginTop: index,
    height: 24 - index,
  }));

  return (
    <div className="bg-foreground pb-36">
      {items.map((item) => (
        <div
          className="bg-background"
          key={item.id}
          style={{
            marginTop: `${item.marginTop}px`,
            height: `${item.height}px`,
          }}
        />
      ))}
    </div>
  );
}
