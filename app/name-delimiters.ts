export function readBalanced(value: string, openingIndex: number) {
  const opening = value[openingIndex];
  const closing = opening === "(" ? ")" : opening === "[" ? "]" : "";
  if (!closing) return null;
  const stack = [closing];
  for (let index = openingIndex + 1; index < value.length; index += 1) {
    const char = value[index];
    if (char === "(" || char === "[") stack.push(char === "(" ? ")" : "]");
    else if (char === ")" || char === "]") {
      if (stack.pop() !== char) return null;
      if (!stack.length) return { text: value.slice(openingIndex + 1, index), end: index + 1, closing };
    }
  }
  return null;
}
