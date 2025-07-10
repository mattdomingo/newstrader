#include <stdio.h>
#include <stdlib.h>
#include "newsapi.h"
#include "parser.h"
#include "logic.h"
#include "ml_wrapper.h"

const char *rec_to_str(Recommendation r) {
    switch (r) {
        case BUY: return "BUY";
        case SELL: return "SELL";
        default: return "HOLD";
    }
}

int main(void) {
    printf("Fetching latest 10 tech industry news headlines...\n\n");

    char *json = NULL;
    if (fetch_latest_headlines(&json)) {
        return EXIT_FAILURE;
    }

    Article *articles = NULL;
    int count = 0;
    if (parse_articles(json, &articles, &count)) {
        fprintf(stderr, "Failed to parse articles\n");
        free(json);
        return EXIT_FAILURE;
    }
    free(json);

    for (int i = 0; i < count; i++) {
        // Pass headline, publishedAt, and URL to the analyze_headline function
        analyze_headline(articles[i].title, articles[i].publishedAt, articles[i].url);
        
        // Adding a blank line between article analyses for readability
        if (i < count - 1) {
            printf("\n");
        }
    }

    free_articles(articles, count);
    return EXIT_SUCCESS;
}
