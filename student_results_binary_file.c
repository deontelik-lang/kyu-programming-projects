/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that reads student results from a binary file.
- A structure holds the name, registration number and total marks
- All records are read from results.dat
- The name and marks of each student are displayed
*/

#include <stdio.h>

struct Student
{
    char name[50];
    char reg_no[20];
    float total_marks;
};

int main()
{
    FILE *fp;
    struct Student s;

    fp = fopen("results.dat", "rb");
    if (fp == NULL)
    {
        printf("Error: could not open results.dat.\n");
        printf("Run create_sample_results_file first to create it.\n");
        return 1;
    }

    printf("Student Results:\n");
    while (fread(&s, sizeof(struct Student), 1, fp) == 1)
    {
        printf("Name: %s | Marks: %.2f\n", s.name, s.total_marks);
    }

    fclose(fp);

    return 0;
}
