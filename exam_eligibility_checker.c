/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that checks if a student is eligible for final exams.
- Attendance must be 75% or more AND
- Average marks must be 40 or more
- Otherwise the student is not eligible
*/

#include <stdio.h>

int main()
{
    float attendance, average_marks;

    printf("Enter the attendance (%%): ");
    scanf("%f", &attendance);

    printf("Enter the average marks: ");
    scanf("%f", &average_marks);

    if (attendance >= 75 && average_marks >= 40)
    {
        printf("Eligible for final exams.\n");
    }
    else
    {
        printf("Not eligible.\n");
    }

    return 0;
}
