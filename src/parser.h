#ifndef PARSER_H
#define PARSER_H

typedef struct {
    char *publishedAt;
    char *title;
    char *url;    // URL to the full article
} Article;

int parse_articles(const char *json, Article **articles, int *count);
void free_articles(Article *articles, int count);

#endif // PARSER_H
