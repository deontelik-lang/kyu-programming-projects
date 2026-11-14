/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that records borrowed library books in a text file.
- The title is appended to borrowed_books.txt (existing records are kept)
- A confirmation message is displayed after the title is stored
*/

#include <stdio.h>
#include <string.h>

int main()
{
    FILE *fp;
    char title[100];

    printf("Enter the book title: ");
    fgets(title, sizeof(title), stdin);
    title[strcspn(title, "\n")] = '\0';

    /* "a" mode appends, so existing records are not deleted */
    fp = fopen("borrowed_books.txt", "a");
    if (fp == NULL)
    {
        printf("Error: could not open the file.\n");
        return 1;
    }

    fprintf(fp, "%s\n", title);
    fclose(fp);

    printf("Book title stored successfully.\n");

    return 0;
}
