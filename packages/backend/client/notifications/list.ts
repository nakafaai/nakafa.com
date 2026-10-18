/**
 * Rows one page of the inbox holds at most, and how many the inbox asks for at
 * first and each time its end comes into view. The server reads at most 100 rows
 * for one page, so a larger request is cut to that.
 */
export const INBOX_PAGE_SIZE = 20;
