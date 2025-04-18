#include "newsapi.h"
#include <curl/curl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define URL "https://newsapi.org/v2/top-headlines?category=technology&pageSize=10&apiKey=0f64f75298ec40a9818c972bc74fabd9"

struct memory {
    char *response;
    size_t size;
};

static size_t write_callback(void *data, size_t size, size_t nmemb, void *userp) {
    size_t realsize = size * nmemb;
    struct memory *mem = (struct memory *)userp;
    char *ptr = realloc(mem->response, mem->size + realsize + 1);
    if (!ptr) {
        fprintf(stderr, "Failed to allocate memory\n");
        return 0;
    }
    mem->response = ptr;
    memcpy(&(mem->response[mem->size]), data, realsize);
    mem->size += realsize;
    mem->response[mem->size] = '\0';
    return realsize;
}

int fetch_latest_headlines(char **json_response) {
    CURL *curl;
    CURLcode res;
    struct memory mem = {0};
    int attempts = 0;

    curl = curl_easy_init();
    if(!curl) {
        fprintf(stderr, "Failed to initialize libcurl\n");
        return 1;
    }

    curl_easy_setopt(curl, CURLOPT_URL, URL);
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 15L);
    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "User-Agent: SimpleNewsTrader/1.0");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&mem);

    do {
        res = curl_easy_perform(curl);
        if (res == CURLE_OK)
            break;
        fprintf(stderr, "libcurl error: %s. Retrying...\n", curl_easy_strerror(res));
    } while(++attempts < 2);

    curl_slist_free_all(headers);
    curl_easy_cleanup(curl);

    if(res != CURLE_OK) {
        fprintf(stderr, "Failed to fetch news after retries: %s\n", curl_easy_strerror(res));
        free(mem.response);
        return 1;
    }

    *json_response = mem.response;
    return 0;
}
