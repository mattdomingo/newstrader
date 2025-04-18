CC = clang
CFLAGS = -Wall -std=c11
LDFLAGS = -lcurl

SRC = src/main.c src/newsapi.c src/parser.c src/logic.c
OBJ = $(SRC:.c=.o)
HDR = src/newsapi.h src/parser.h src/logic.h

all: trader

trader: $(OBJ)
	$(CC) $(CFLAGS) -o $@ $^ $(LDFLAGS)

%.o: %.c $(HDR)
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f src/*.o trader

.PHONY: all clean
