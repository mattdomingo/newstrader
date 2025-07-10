#include "parser.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int parse_articles(const char *json, Article **articles, int *count) {
    const char *p = json;
    int max_articles = 10;
    Article *arr = malloc(max_articles * sizeof(Article));
    if (!arr) return 1;
    int idx = 0;
    while (idx < max_articles) {
        const char *ts_start = strstr(p, "\"publishedAt\":\"");
        if (!ts_start) break;
        ts_start += strlen("\"publishedAt\":\"");
        const char *ts_end = strchr(ts_start, '\"');
        if (!ts_end) break;
        size_t ts_len = ts_end - ts_start;
        arr[idx].publishedAt = malloc(ts_len + 1);
        if (!arr[idx].publishedAt) {
            free(arr);
            return 1;
        }
        strncpy(arr[idx].publishedAt, ts_start, ts_len);
        arr[idx].publishedAt[ts_len] = '\0';

        const char *t_start = strstr(ts_end, "\"title\":\"");
        if (!t_start) break;
        t_start += strlen("\"title\":\"");
        const char *t_end = strchr(t_start, '\"');
        if (!t_end) break;
        size_t t_len = t_end - t_start;
        arr[idx].title = malloc(t_len + 1);
        if (!arr[idx].title) {
            free(arr[idx].publishedAt);
            free(arr);
            return 1;
        }
        strncpy(arr[idx].title, t_start, t_len);
        arr[idx].title[t_len] = '\0';

        // Extract the URL
        const char *u_start = strstr(t_end, "\"url\":\"");
        if (!u_start) {
            // If URL is not found, set it as an empty string
            arr[idx].url = malloc(1);
            if (!arr[idx].url) {
                // Free already allocated memory before returning error
                for (int j = 0; j <= idx; j++) {
                    free(arr[j].publishedAt);
                    free(arr[j].title);
                }
                free(arr);
                return 1;
            }
            arr[idx].url[0] = '\0';
        } else {
            u_start += strlen("\"url\":\"");
            const char *u_end = strchr(u_start, '\"');
            if (!u_end) {
                // If URL format is incorrect, set it as an empty string
                arr[idx].url = malloc(1);
                if (!arr[idx].url) {
                    // Free already allocated memory before returning error
                    for (int j = 0; j <= idx; j++) {
                        free(arr[j].publishedAt);
                        free(arr[j].title);
                    }
                    free(arr);
                    return 1;
                }
                arr[idx].url[0] = '\0';
            } else {
                size_t u_len = u_end - u_start;
                arr[idx].url = malloc(u_len + 1);
                if (!arr[idx].url) {
                    // Free already allocated memory before returning error
                    for (int j = 0; j <= idx; j++) {
                        free(arr[j].publishedAt);
                        free(arr[j].title);
                    }
                    free(arr);
                    return 1;
                }
                strncpy(arr[idx].url, u_start, u_len);
                arr[idx].url[u_len] = '\0';
            }
        }

        idx++;
        p = t_end + 1;
    }
    *articles = arr;
    *count = idx;
    return 0;
}

void free_articles(Article *articles, int count) {
    for (int i = 0; i < count; i++) {
        free(articles[i].publishedAt);
        free(articles[i].title);
        free(articles[i].url);
    }
    free(articles);
}
