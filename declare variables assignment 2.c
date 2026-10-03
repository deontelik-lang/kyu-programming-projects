//variables and Data Types

#include<stdio.h>

int main(){
     //declare variables
     char grade; //%u
     char name [15];//%s
     int age; //%d
     float mark;//%f
     double pi;//%lf
     printf("Enter the grade:\t");
     scanf("%u",&grade);

     printf("Enter name:\t");
     scanf("%s",&name);

     printf("Enter your age:\t");
     scanf("%d",&age);

     printf("Enter your marks:\t");
     scanf("%f",&mark);

     printf("Enter the pi:\t");
     scanf("%lf",&pi);


     return 0;}
