#ifndef LOGIC_H
#define LOGIC_H

typedef enum { BUY, SELL, HOLD } Recommendation;

Recommendation analyze_headline(const char *headline, const char *publishedAt, const char *url);

#endif // LOGIC_H
