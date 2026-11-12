export const formatDate = (dateStr: string): string | null => {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
};