#ifndef ML_WRAPPER_H
#define ML_WRAPPER_H

// Calls the Python microservice and returns sentiment score.
// If tokens_out is non-NULL, allocates a JSON string of explanation tokens.
double call_python_service(const char *headline, char **tokens_out);

#endif // ML_WRAPPER_H
