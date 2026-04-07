export const getImage = (category: string, color: string) => {
  return new URL(
    `../assets/${category.toLowerCase()}/${category} ${color}.png`,
    import.meta.url
  ).href;
};
