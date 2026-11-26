export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
export const addSeconds = (d: Date, s: number) => new Date(d.getTime() + s * 1000);
