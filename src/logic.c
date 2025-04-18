#include "logic.h"
#include <string.h>
#include <ctype.h>
#include <stdlib.h>
#include <stdio.h>
#include <curl/curl.h>
#include <time.h>

// External function declaration from main.c
extern const char *rec_to_str(Recommendation r);

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

// Function to convert ISO8601 date string to local time
char* convert_to_local_time(const char* iso_date) {
    struct tm tm_time = {0};
    char* result = malloc(32); // Enough for formatted date
    
    if (!result) return NULL;
    
    // Parse ISO8601 date (format: "2023-05-12T15:30:45Z")
    int year, month, day, hour, min, sec;
    if (sscanf(iso_date, "%d-%d-%dT%d:%d:%d", 
               &year, &month, &day, &hour, &min, &sec) != 6) {
        // Handle parsing failure
        strcpy(result, iso_date);
        return result;
    }
    
    // Fill the tm structure
    tm_time.tm_year = year - 1900;  // Years since 1900
    tm_time.tm_mon = month - 1;     // Months are 0-11
    tm_time.tm_mday = day;
    tm_time.tm_hour = hour;
    tm_time.tm_min = min;
    tm_time.tm_sec = sec;
    
    // Get the time difference between UTC and local time
    time_t now = time(NULL);
    struct tm *local_now = localtime(&now);
    struct tm utc_now = *local_now;
    
    // Adjust for the local time zone
    time_t local_time_t = mktime(&tm_time);
    local_time_t += (mktime(local_now) - mktime(&utc_now));
    
    // Convert to local time
    struct tm* local_time = localtime(&local_time_t);
    
    // Format the local time
    strftime(result, 32, "%Y-%m-%d %H:%M:%S %Z", local_time);
    
    return result;
}

// Function to call the Python ML service
double call_python_service(const char *headline, const char *url, char **explanation) {
    CURL *curl;
    CURLcode res;
    struct memory mem = {0};
    double sentiment_score = 0.0;
    
    curl = curl_easy_init();
    if (!curl) {
        fprintf(stderr, "Failed to initialize libcurl\n");
        return 0.0;
    }
    
    curl_easy_setopt(curl, CURLOPT_URL, "http://127.0.0.1:5000/analyze");
    curl_easy_setopt(curl, CURLOPT_POST, 1L);
    
    // Create JSON payload with both text and URL
    char *json_payload;
    if (url && *url) {
        // URL is provided, let's use it
        json_payload = malloc(strlen(headline) + strlen(url) + 100);
        if (!json_payload) {
            curl_easy_cleanup(curl);
            return 0.0;
        }
        sprintf(json_payload, "{\"text\":\"%s\",\"url\":\"%s\"}", headline, url);
    } else {
        // No URL, just use the headline
        json_payload = malloc(strlen(headline) + 100);
        if (!json_payload) {
            curl_easy_cleanup(curl);
            return 0.0;
        }
        sprintf(json_payload, "{\"text\":\"%s\"}", headline);
    }
    
    curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json_payload);
    
    struct curl_slist *headers = NULL;
    headers = curl_slist_append(headers, "Content-Type: application/json");
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
    
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, (void *)&mem);
    
    res = curl_easy_perform(curl);
    
    free(json_payload);
    curl_slist_free_all(headers);
    
    if (res != CURLE_OK) {
        fprintf(stderr, "Failed to call ML service: %s\n", curl_easy_strerror(res));
        curl_easy_cleanup(curl);
        free(mem.response);
        return 0.0;
    }
    
    // Parse JSON response to extract sentiment score and tokens
    const char *sentiment_start = strstr(mem.response, "\"sentiment\":");
    if (sentiment_start) {
        sentiment_start += strlen("\"sentiment\":");
        sentiment_score = atof(sentiment_start);
    }
    
    const char *tokens_start = strstr(mem.response, "\"tokens\":");
    if (tokens_start && explanation) {
        tokens_start += strlen("\"tokens\":");
        const char *tokens_array_start = strchr(tokens_start, '[');
        if (tokens_array_start) {
            const char *tokens_array_end = strchr(tokens_array_start, ']');
            if (tokens_array_end) {
                size_t len = tokens_array_end - tokens_array_start + 1;
                *explanation = malloc(len + 1);
                strncpy(*explanation, tokens_array_start, len);
                (*explanation)[len] = '\0';
            }
        }
    }
    
    curl_easy_cleanup(curl);
    free(mem.response);
    
    return sentiment_score;
}

Recommendation analyze_headline(const char *headline, const char *publishedAt, const char *url) {
    char *why = NULL;
    double score = call_python_service(headline, url, &why);

    Recommendation rec = HOLD;
    if      (score >  0.2) rec = BUY;
    else if (score < -0.2) rec = SELL;

    // Convert the publishedAt time to local timezone
    char *local_time = convert_to_local_time(publishedAt);
    
    // Output the article information with local time
    printf("[%s] \"%s\"\n", local_time ? local_time : publishedAt, headline);
    
    // Print the URL if available
    if (url && *url) {
        printf("Article URL: %s\n", url);
    }
    
    printf("Recommendation: %s (sentiment=%.2f)\n", rec_to_str(rec), score);
    if (why) {
        printf("  Explanation tokens: %s\n", why);
        free(why);
    }
    
    // Free the local time string
    if (local_time) {
        free(local_time);
    }
    
    return rec;
}
