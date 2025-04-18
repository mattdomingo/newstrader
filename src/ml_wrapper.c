#include "ml_wrapper.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <curl/curl.h>

struct mem {
    char *buf;
    size_t size;
};

static size_t cb(void *data, size_t size, size_t nmemb, void *userp) {
    size_t realsz = size * nmemb;
    struct mem *m = (struct mem *)userp;
    char *ptr = realloc(m->buf, m->size + realsz + 1);
    if (!ptr) return 0;
    m->buf = ptr;
    memcpy(m->buf + m->size, data, realsz);
    m->size += realsz;
    m->buf[m->size] = '\\0';
    return realsz;
}

double call_python_service(const char *headline, char **tokens_out) {
    CURL *curl = curl_easy_init();
    if (!curl) return 0.0;
    struct mem m = { .buf = NULL, .size = 0 };
    const char *url = "http://127.0.0.1:5000/analyze";
    char *payload = NULL;
    asprintf(&payload, "{{\"text\":\"%s\"}}", headline);

    struct curl_slist *hdr = NULL;
    hdr = curl_slist_append(hdr, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_URL, url);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, hdr);
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, payload);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, cb);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &m);

    CURLcode res = curl_easy_perform(curl);
    curl_slist_free_all(hdr);
    curl_easy_cleanup(curl);
    free(payload);

    double sentiment = 0.0;
    if (res == CURLE_OK) {
        // parse "sentiment": value
        char *p = strstr(m.buf, "\"sentiment\":");
        if (p) sentiment = atof(p + strlen("\"sentiment\":"));
        if (tokens_out) {
            char *t_start = strstr(m.buf, "\"tokens\":");
            if (t_start) {
                *tokens_out = strdup(t_start);
            }
        }
    }
    free(m.buf);
    return sentiment;
}
