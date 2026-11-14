/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A helper program that creates sample student records in results.dat.
- Run this first so that student_results.c has a file to read
- It uses the same structure as student_results.c
*/

#include <stdio.h>
#include <string.h>

struct Student
{
    char name[50];
    char reg_no[20];
    float total_marks;
};

int main()
{
    FILE *fp;
    struct Student students[3];
    int i;

    strcpy(students[0].name, "Alice Wanjiru");
    strcpy(students[0].reg_no, "CT100/G/0001/26");
    students[0].total_marks = 78.5;

    strcpy(students[1].name, "Brian Otieno");
    strcpy(students[1].reg_no, "CT100/G/0002/26");
    students[1].total_marks = 64.0;

    strcpy(students[2].name, "Cynthia Achieng");
    strcpy(students[2].reg_no, "CT100/G/0003/26");
    students[2].total_marks = 91.0;

    fp = fopen("results.dat", "wb");
    if (fp == NULL)
    {
        printf("Error: could not create results.dat.\n");
        return 1;
    }

    for (i = 0; i < 3; i++)
    {
        fwrite(&students[i], sizeof(struct Student), 1, fp);
    }

    fclose(fp);
    printf("results.dat created with 3 records.\n");

    return 0;
}
