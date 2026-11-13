/*
Name:Brayan kihanga
Reg no:CT100/G/30673/26.
Date :14/11/2026
Description:program to check voter eligibility
*/
#include<stdio.h>

//mainfunction
int main(){
     //variabledeclaration
     int age;

     printf("Enter age :\t");
     scanf("%d",&age);

     if(age>=18){
        printf("you are eligible to vote");

     }
     else{
        printf("you are not eligible to vote");
     }
     return 0 ;}

